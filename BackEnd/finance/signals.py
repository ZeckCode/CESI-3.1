from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from finance.models import Transaction
from finance.utils import recompute_transaction_statuses_for_enrollment


@receiver(post_save, sender=Transaction)
def refresh_transaction_status_on_save(sender, instance, **kwargs):
    if instance.enrollment_id:
        recompute_transaction_statuses_for_enrollment(instance.enrollment)


@receiver(post_delete, sender=Transaction)
def refresh_transaction_status_on_delete(sender, instance, **kwargs):
    if instance.enrollment_id:
        recompute_transaction_statuses_for_enrollment(instance.enrollment)
