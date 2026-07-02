#include <OneWire.h>
#include <DallasTemperature.h>

#define ONE_WIRE_BUS 4
#define TURBIDITY_PIN 34

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(115200);
  sensors.begin();
}

void loop() {
  sensors.requestTemperatures();
  int value = analogRead(TURBIDITY_PIN);
  float temperatureC = sensors.getTempCByIndex(0);  
  Serial.print("TURBIDITY: ");
  Serial.println(value);
  delay(1000);
  Serial.print("Temperature: ");
  Serial.print(temperatureC);
  Serial.println(" °C");

  delay(1000);
}
