from corks import app, load_modules

load_modules(
    'db',
    'api',
    'official_account'
)

application = app
