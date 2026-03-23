#!/usr/bin/env python
"""Add LRN and SN to Johnny Doe"""
import os
import sys
import django
import random

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CESI.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from accounts.models import User, UserProfile

# Find Johnny Doe
try:
    johnny = User.objects.get(username='johndoe')
    print(f"Found user: {johnny.username}")
    profile = johnny.profile
    print(f"Current LRN: {profile.lrn}, SN: {profile.student_number}")
    
    # Generate random LRN (format: 12-digit number) and SN (format: 8-digit)
    lrn = ''.join([str(random.randint(0, 9)) for _ in range(12)])
    sn = ''.join([str(random.randint(0, 9)) for _ in range(8)])
    
    profile.lrn = lrn
    profile.student_number = sn
    profile.save()
    
    print(f"✓ Updated! New LRN: {lrn}, New SN: {sn}")
except User.DoesNotExist:
    print("✗ Johnny Doe not found. Available users:")
    users = User.objects.all()
    for u in users:
        print(f"  - {u.username} ({u.role})")
except Exception as e:
    print(f"✗ Error: {e}")
