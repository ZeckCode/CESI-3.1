// EnrollmentStepper.jsx
import React from "react";
import { STEP_KEYS } from "./constants";

const steps = [
  "Privacy",
  "Instructions",
  "Academic",
  "Student",
  "Family",
  "Documents",
  "Payment",
];

const EnrollmentStepper = ({ currentStep, maxReachedStep = STEP_KEYS.PRIVACY, onStepClick }) => {
  return (
    <div className="stepper">
      {steps.map((label, index) => {
        const isActive = currentStep === index;
        const isDone = index <= maxReachedStep && !isActive;
        const isClickable =
          typeof onStepClick === "function" &&
          index <= maxReachedStep &&
          !isActive;

        return (
          <button
            type="button"
            key={label}
            className={`stepper__item ${
              isActive ? "is-active" : ""
            } ${isDone ? "is-done" : ""} ${isClickable ? "is-clickable" : ""}`}
            onClick={() => {
              if (isClickable) onStepClick(index);
            }}
            disabled={!isClickable}
            aria-current={isActive ? "step" : undefined}
          >
            <span className="stepper__circle">{index + 1}</span>
            <small>{label}</small>
          </button>
        );
      })}
    </div>
  );
};

export default EnrollmentStepper;