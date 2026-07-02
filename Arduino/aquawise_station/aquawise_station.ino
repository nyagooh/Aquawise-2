/*
 * Aquawise Station — reads temperature & turbidity, POSTs to Django
 *
 * Board   : ESP32
 * Sensors : DS18B20 temperature (OneWire, pin 4)
 *           Turbidity sensor    (analog, pin 34)
 * Libraries (install via Library Manager):
 *   - ArduinoJson       by Benoit Blanchon
 *   - OneWire           by Paul Stoffregen
 *   - DallasTemperature by Miles Burton
 *
 * Public URL setup (ngrok):
 *   1. Install ngrok: https://ngrok.com/download
 *   2. Run: ngrok http 8000
 *   3. Paste the https://xxxx.ngrok-free.app URL into DEFAULT_SERVER_URL below.
 *   4. Run Django with: python manage.py runserver 0.0.0.0:8000
 *
 * On each boot:
 *   - Press 1 (or wait 5 s) to keep the current server URL.
 *   - Press 2 to paste a new URL via Serial.
 *   - Press 1 (or wait 5 s) to connect to the preset WiFi.
 *   - Press 2 to scan and pick a different network.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ── Pin definitions ───────────────────────────────────────────────────────────
#define ONE_WIRE_BUS  4   // DS18B20 data pin
#define TURBIDITY_PIN 34  // Turbidity sensor analog pin

// ── Configuration ─────────────────────────────────────────────────────────────
const char* DEFAULT_WIFI_SSID     = "Javis";
const char* DEFAULT_WIFI_PASSWORD = "777ascii";

// Full public URL — paste your ngrok URL here (keep the /api/ingest/ path)
// Example: "https://abcd-1234.ngrok-free.app/api/ingest/"
const char* DEFAULT_SERVER_URL = "https://unincarnate-adele-inculpably.ngrok-free.dev/api/ingest/";

// Must match a WaterSource name in the database exactly (case-insensitive)
const char* STATION_NAME = "Dunga Beach Station";

#define CHOICE_TIMEOUT_MS 5000
#define READ_INTERVAL_MS  2000  // how often to read sensors and POST
// ──────────────────────────────────────────────────────────────────────────────

WiFiClientSecure  secureClient;
OneWire           oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);
String            serverUrl;

// ── Sensor reading ────────────────────────────────────────────────────────────

float readTemperature() {
  tempSensor.requestTemperatures();
  return tempSensor.getTempCByIndex(0);
}

// Convert raw 12-bit ADC value to NTU.
// Formula matches typical SEN0189-style turbidity sensors at 3.3 V.
// Calibrate the constants for your specific sensor if needed.
float readTurbidity() {
  // Average 10 samples to reduce noise
  long sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += analogRead(TURBIDITY_PIN);
    delay(5);
  }
  float voltage = (sum / 10.0 / 4095.0) * 3.3;
  float ntu     = -1120.4 * voltage * voltage + 5742.3 * voltage - 4352.9;
  return max(ntu, 0.0f);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

String readLine() {
  while (!Serial.available()) { delay(10); }
  String s = Serial.readStringUntil('\n');
  s.trim();
  return s;
}

// Wait up to timeoutMs for '1' or '2'. Prints a live countdown.
char promptChoice(unsigned long timeoutMs) {
  unsigned long start   = millis();
  int           lastSec = -1;

  while (millis() - start < timeoutMs) {
    int secsLeft = (timeoutMs - (millis() - start)) / 1000;
    if (secsLeft != lastSec) {
      Serial.print("\r  Choice (");
      Serial.print(secsLeft);
      Serial.print("s)... ");
      lastSec = secsLeft;
    }
    if (Serial.available()) {
      char c = Serial.read();
      while (Serial.available()) Serial.read();
      if (c == '1' || c == '2') { Serial.println(c); return c; }
    }
    delay(50);
  }
  Serial.println("\n  -> Timed out, using default.");
  return 0;
}

// ── URL configuration ─────────────────────────────────────────────────────────

void configureUrl() {
  Serial.println("---- Server URL ----");
  Serial.print("  Current: "); Serial.println(serverUrl);
  Serial.println("  Press 1 to keep  |  Press 2 to enter a new URL");

  if (promptChoice(CHOICE_TIMEOUT_MS) == '2') {
    Serial.print("  Paste new URL: ");
    serverUrl = readLine();
    Serial.print("  URL set to: "); Serial.println(serverUrl);
  } else {
    Serial.println("  Keeping current URL.");
  }
}

// ── WiFi ──────────────────────────────────────────────────────────────────────

int scanAndPrint() {
  Serial.println("\n  Scanning for WiFi networks...");
  int n = WiFi.scanNetworks();
  if (n == 0) { Serial.println("  No networks found."); return 0; }
  for (int i = 0; i < n; i++) {
    Serial.print("    ["); Serial.print(i + 1); Serial.print("] ");
    Serial.print(WiFi.SSID(i));
    Serial.print("  ("); Serial.print(WiFi.RSSI(i)); Serial.print(" dBm)");
    if (WiFi.encryptionType(i) == WIFI_AUTH_OPEN) Serial.print("  [open]");
    Serial.println();
  }
  return n;
}

void pickWifi() {
  int n = scanAndPrint();
  if (n == 0) { delay(5000); n = scanAndPrint(); if (n == 0) return; }

  int choice = 0;
  while (choice < 1 || choice > n) {
    Serial.print("\n  Select network [1-"); Serial.print(n); Serial.print("]: ");
    choice = readLine().toInt();
    if (choice < 1 || choice > n) Serial.println("  Invalid, try again.");
  }
  String ssid = WiFi.SSID(choice - 1);
  Serial.println(ssid);

  Serial.print("  Password (blank if open): ");
  String pw = readLine();

  Serial.print("  Connecting to "); Serial.print(ssid); Serial.print("...");
  WiFi.begin(ssid.c_str(), pw.c_str());
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) { delay(500); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? "\n  Connected!" : "\n  Failed to connect.");
}

void connectToPreset() {
  Serial.print("  Connecting to "); Serial.print(DEFAULT_WIFI_SSID); Serial.print("...");
  WiFi.begin(DEFAULT_WIFI_SSID, DEFAULT_WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) { delay(500); Serial.print("."); }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n  Connected!");
  } else {
    Serial.println("\n  Preset network not reachable.");
    WiFi.disconnect(true); delay(500);
    pickWifi();
  }
}

void configureWifi() {
  Serial.println("---- WiFi ----");
  Serial.print("  Preset SSID: "); Serial.println(DEFAULT_WIFI_SSID);
  Serial.println("  Press 1 to connect to preset  |  Press 2 to choose another network");

  if (promptChoice(CHOICE_TIMEOUT_MS) == '2') {
    WiFi.disconnect(true); delay(500);
    pickWifi();
  } else {
    connectToPreset();
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(1000);

  secureClient.setInsecure();
  serverUrl = String(DEFAULT_SERVER_URL);

  tempSensor.begin();
  analogReadResolution(12);

  Serial.println("\n======= Aquawise Station =======");
  configureUrl();
  Serial.println();
  configureWifi();
  Serial.println("\n================================");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP address : "); Serial.println(WiFi.localIP());
  }
  Serial.print("Server URL : "); Serial.println(serverUrl);
  Serial.println("================================\n");
}

// ── Loop ──────────────────────────────────────────────────────────────────────

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost. Reconnecting...");
    WiFi.disconnect(true); delay(500);
    connectToPreset();
    return;
  }

  float temperature = readTemperature();
  float turbidity   = readTurbidity();

  Serial.println("--- Reading sensors ---");
  Serial.print("  Temperature : "); Serial.print(temperature); Serial.println(" C");
  Serial.print("  Turbidity   : "); Serial.print(turbidity);   Serial.println(" NTU");

  StaticJsonDocument<128> doc;
  doc["station"]     = STATION_NAME;
  doc["temperature"] = temperature;
  doc["turbidity"]   = turbidity;

  String payload;
  serializeJson(doc, payload);

  Serial.print("Sending: "); Serial.println(payload);

  HTTPClient http;
  http.begin(secureClient, serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    Serial.print("HTTP status: "); Serial.println(httpCode);
    Serial.print("Response:    "); Serial.println(http.getString());
  } else {
    Serial.print("HTTP error:  "); Serial.println(http.errorToString(httpCode));
  }

  http.end();
  Serial.println();

  delay(READ_INTERVAL_MS);
}
