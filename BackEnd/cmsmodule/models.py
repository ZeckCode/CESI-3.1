from django.db import models
from django.core.exceptions import ValidationError

class SingletonModel(models.Model):
    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.pk = 1
        return super(SingletonModel, self).save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

class SchoolInformation(SingletonModel):
    school_name = models.CharField(max_length=255, default="Our School")
    about_text = models.TextField(blank=True, default="Welcome to our school.")

    class Meta:
        verbose_name_plural = "School Information"

    def __str__(self):
        return "School Information"

class MissionVision(SingletonModel):
    mission_text = models.TextField(blank=True, default="Our mission is to provide excellent education.")
    vision_text = models.TextField(blank=True, default="Our vision is to be a leading educational institution.")

    class Meta:
        verbose_name_plural = "Mission & Vision"

    def __str__(self):
        return "Mission and Vision"

class ContactInquiry(SingletonModel):
    address = models.TextField(blank=True, default="123 School St., City, Country")
    phone_number = models.CharField(max_length=50, blank=True, default="+1234567890")
    email = models.EmailField(blank=True, default="info@school.edu")
    facebook_link = models.URLField(blank=True, default="")

    class Meta:
        verbose_name_plural = "Contact & Inquiry"

    def __str__(self):
        return "Contact and Inquiry"
