from .base import *  # noqa: F401, F403

DEBUG = True

CORS_ALLOW_ALL_ORIGINS = True

INSTALLED_APPS += ["debug_toolbar"]  # noqa: F405

MIDDLEWARE = ["debug_toolbar.middleware.DebugToolbarMiddleware"] + MIDDLEWARE  # noqa: F405

INTERNAL_IPS = ["127.0.0.1"]

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO"},
        "apps": {"handlers": ["console"], "level": "DEBUG"},
        "celery": {"handlers": ["console"], "level": "DEBUG"},
    },
}
