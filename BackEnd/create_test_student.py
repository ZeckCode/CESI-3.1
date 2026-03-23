#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CESI.settings')
django.setup()

from accounts.models import User, UserProfile, Section

# Check if user already exists
if User.objects.filter(username='student2_test').exists():
    print('✓ Student 2 already exists!')
    user = User.objects.get(username='student2_test')
else:
    # Create second student user with unique email
    user = User.objects.create_user(
        username='student2_test',
        email=f'student2.test.{User.objects.count()}@test.local',
        password='TestPass123!@',
        role='PARENT_STUDENT'
    )
    
    # Try to get a section or use None
    section = Section.objects.first()
    
    # Create profile with correct fields
    profile = UserProfile.objects.create(
        user=user,
        student_first_name='Test',
        student_last_name='Student2',
        parent_first_name='Parent',
        parent_last_name='Two',
        grade_level='grade1',
        contact_number='555-0002',
        address='Test Address 2',
        section=section
    )
    print('✓ Student 2 created successfully!')

print('')
print('═' * 50)
print('TEST CREDENTIALS - Student 2')
print('═' * 50)
print(f'Username: student2_test')
print(f'Password: TestPass123!@')
print(f'Name:     Test Student2')
print('═' * 50)
print('')
print('Ready to test student-to-student DM!')

