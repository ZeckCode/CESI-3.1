import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CESI.settings')
import django
django.setup()
from accounts.models import User
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

print('Users:', User.objects.count())
user = User.objects.filter(role='ADMIN').first() or User.objects.first()
print('Using user', user)
if user is None:
    raise SystemExit('No user found')

# get token if available
try:
    token = Token.objects.filter(user=user).first()
    if token is None:
        token = Token.objects.create(user=user)
    print('Token', token.key)
except Exception as e:
    print('Token error', e)
    token = None

import requests

message_id = 1
url = f'http://127.0.0.1:8000/api/messaging/messages/{message_id}/delete_by_admin/'
headers = {'Authorization': f'Token {token.key}'} if token else {}

payload = {'reason': 'Test from script'}

print('POSTING', url, payload)
resp = requests.delete(url, headers=headers, json=payload)
print('STATUS', resp.status_code)
print('HEADERS', resp.headers)
print('TEXT', resp.text)
