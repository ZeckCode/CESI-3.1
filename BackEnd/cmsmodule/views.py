from rest_framework import generics
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from .models import SchoolInformation, MissionVision, ContactInquiry
from .serializers import SchoolInformationSerializer, MissionVisionSerializer, ContactInquirySerializer

class BaseSingletonView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticatedOrReadOnly]
    
    def get_object(self):
        return self.queryset.model.load()

class SchoolInformationView(BaseSingletonView):
    queryset = SchoolInformation.objects.all()
    serializer_class = SchoolInformationSerializer

class MissionVisionView(BaseSingletonView):
    queryset = MissionVision.objects.all()
    serializer_class = MissionVisionSerializer

class ContactInquiryView(BaseSingletonView):
    queryset = ContactInquiry.objects.all()
    serializer_class = ContactInquirySerializer

