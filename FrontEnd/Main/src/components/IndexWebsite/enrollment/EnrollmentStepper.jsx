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

const EnrollmentStepper = ({ currentStep }) => {
  return (
    <div className="stepper">
      {steps.map((label, index) => {
        const isActive = currentStep === index;
        const isDone = currentStep > index;

        return (
          <div
            key={label}
            className={`stepper__item ${
              isActive ? "is-active" : ""
            } ${isDone ? "is-done" : ""}`}
          >
            <span className="stepper__circle">{index + 1}</span>
            <small>{label}</small>
          </div>
        );
      })}
    </div>
  );
};

export default EnrollmentStepper;