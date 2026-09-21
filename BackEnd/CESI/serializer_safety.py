from rest_framework import serializers
from rest_framework.fields import empty


DEFAULT_VALIDATION_MESSAGE = "Invalid input provided."
DEFAULT_SAVE_MESSAGE = "Unable to process the request. Please check the submitted data."


def _clean_text(value, fallback):
    text = str(value or "").strip()
    if not text:
        return fallback

    # Normalize whitespace so clients get clean one-line messages.
    text = " ".join(text.split())

    # Avoid leaking stack traces or internal exception payloads.
    sensitive_tokens = ("Traceback", "Exception:", "IntegrityError", "OperationalError", "File \"")
    if any(token in text for token in sensitive_tokens):
        return fallback

    if len(text) > 240:
        return f"{text[:237]}..."

    return text


def _is_empty_detail(detail):
    if detail is None:
        return True
    if isinstance(detail, str):
        return detail.strip() == ""
    if isinstance(detail, list):
        return len(detail) == 0
    if isinstance(detail, dict):
        return len(detail) == 0
    return False


def sanitize_error_detail(detail, fallback=DEFAULT_VALIDATION_MESSAGE):
    if isinstance(detail, dict):
        cleaned = {}
        for key, value in detail.items():
            sanitized = sanitize_error_detail(value, fallback=fallback)
            if not _is_empty_detail(sanitized):
                cleaned[key] = sanitized
        if cleaned:
            return cleaned
        return {"non_field_errors": [fallback]}

    if isinstance(detail, (list, tuple, set)):
        cleaned_items = []
        for item in detail:
            sanitized = sanitize_error_detail(item, fallback=fallback)
            if not _is_empty_detail(sanitized):
                cleaned_items.append(sanitized)
        if cleaned_items:
            return cleaned_items
        return [fallback]

    return _clean_text(detail, fallback)


class SafeSerializerMixin:
    validation_fallback_message = DEFAULT_VALIDATION_MESSAGE
    save_fallback_message = DEFAULT_SAVE_MESSAGE

    def _sanitize_validation_detail(self, detail, fallback=None):
        return sanitize_error_detail(
            detail,
            fallback=fallback or self.validation_fallback_message,
        )

    def run_validation(self, data=empty):
        try:
            return super().run_validation(data)
        except serializers.ValidationError as exc:
            raise serializers.ValidationError(
                self._sanitize_validation_detail(getattr(exc, "detail", exc))
            )
        except (TypeError, ValueError, KeyError, AttributeError):
            raise serializers.ValidationError(
                self._sanitize_validation_detail(None)
            )

    def save(self, **kwargs):
        try:
            return super().save(**kwargs)
        except serializers.ValidationError as exc:
            raise serializers.ValidationError(
                self._sanitize_validation_detail(getattr(exc, "detail", exc))
            )
        except Exception:
            raise serializers.ValidationError(
                {"non_field_errors": [self.save_fallback_message]}
            )


class SafeSerializer(SafeSerializerMixin, serializers.Serializer):
    pass


class SafeModelSerializer(SafeSerializerMixin, serializers.ModelSerializer):
    pass
