from rest_framework import serializers
from .models import Enrollment
from accounts.models import User
from accounts.serializers import UserSerializer

class EnrollmentSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)

    class Meta:
        model = Enrollment
        fields = '__all__'

class EnrollmentDetailedSerializer(serializers.ModelSerializer):
    student = UserSerializer(read_only=True)
    section_details = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = '__all__'

    def get_section_details(self, obj):
        return {
            "id": obj.section.id if obj.section else None,
            "name": obj.section.name if obj.section else "No Section",
            "grade_level": obj.section.grade_level if obj.section else None,
        }

class EnrollmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Enrollment
        # Use all fields but make student optional for the frontend
        fields = '__all__'
        extra_kwargs = {
            'student': {'required': False, 'allow_null': True},
            'section': {'required': False, 'allow_null': True},
            'status': {'required': False}
        }

    def create(self, validated_data):
        # Automatically assign or create the public_user
        public_user, _ = User.objects.get_or_create(
            username="public_user",
            defaults={"role": "PUBLIC", "email": "public@school.com"}
        )
        
        validated_data["student"] = public_user
        validated_data["status"] = "PENDING"
        
        return super().create(validated_data)