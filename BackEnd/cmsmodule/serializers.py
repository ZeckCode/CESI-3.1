from rest_framework import serializers
from .models import SchoolInformation, MissionVision, ContactInquiry

class SchoolInformationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolInformation
        fields = '__all__'

class MissionVisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MissionVision
        fields = '__all__'

class ContactInquirySerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactInquiry
        fields = '__all__'