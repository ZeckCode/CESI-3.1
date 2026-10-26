from rest_framework import serializers
from CESI.serializer_safety import SafeSerializer, SafeModelSerializer
from .models import SchoolInformation, MissionVision, ContactInquiry

class SchoolInformationSerializer(SafeModelSerializer):
    class Meta:
        model = SchoolInformation
        fields = '__all__'

class MissionVisionSerializer(SafeModelSerializer):
    class Meta:
        model = MissionVision
        fields = '__all__'

class ContactInquirySerializer(SafeModelSerializer):
    class Meta:
        model = ContactInquiry
        fields = '__all__'