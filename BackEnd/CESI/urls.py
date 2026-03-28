from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
# from .views import me, logout_view

from django.conf import settings
from django.conf.urls.static import static
def home(request):
    return redirect('admin/')

urlpatterns = [
    path('', home),  # root URL
    path('admin/', admin.site.urls),

    # API endpoint paths (for local and plain routing)
    path('api/announcements/', include('announcements.urls')),
    path('announcements/', include('announcements.urls')),

    path('api/accounts/', include('accounts.urls')),
    path('accounts/', include('accounts.urls')),

    path('api/', include('enrollment.urls')),
    path('', include('enrollment.urls')),

    path('api/finance/', include('finance.urls')),
    path('finance/', include('finance.urls')),

    path('api/grades/', include('grades.urls')),
    path('grades/', include('grades.urls')),

    path('api/classmanagement/', include('classmanagement.urls')),
    path('classmanagement/', include('classmanagement.urls')),

    path('api/attendance/', include('attendance.urls')),
    path('attendance/', include('attendance.urls')),

    path('api/messaging/', include('messaging.urls')),
    path('messaging/', include('messaging.urls')),

    path('api/reminders/', include('reminders.urls')),
    path('reminders/', include('reminders.urls')),

    path('api/cms/', include('cmsmodule.urls')),
    path('cms/', include('cmsmodule.urls')),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)