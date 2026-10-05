import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

import "./FormField.css";

type BaseFieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children?: ReactNode;
};

type InputFieldProps = BaseFieldProps & {
  as?: "input";
  inputProps: InputHTMLAttributes<HTMLInputElement>;
};

type SelectFieldProps = BaseFieldProps & {
  as: "select";
  selectProps: SelectHTMLAttributes<HTMLSelectElement>;
  children: ReactNode;
};

type TextareaFieldProps = BaseFieldProps & {
  as: "textarea";
  textareaProps: TextareaHTMLAttributes<HTMLTextAreaElement>;
};

type FormFieldProps =
  | InputFieldProps
  | SelectFieldProps
  | TextareaFieldProps;

export function FormField(props: FormFieldProps) {
  return (
    <label className="form-field">
      <span className="form-field__label">
        {props.label}

        {props.required && (
          <span className="form-field__required">*</span>
        )}
      </span>

      {props.as === "select" ? (
        <select
          className={[
            "form-field__control",
            props.error ? "form-field__control--error" : ""
          ].join(" ")}
          {...props.selectProps}
        >
          {props.children}
        </select>
      ) : props.as === "textarea" ? (
        <textarea
          className={[
            "form-field__control",
            "form-field__textarea",
            props.error ? "form-field__control--error" : ""
          ].join(" ")}
          {...props.textareaProps}
        />
      ) : (
        <input
          className={[
            "form-field__control",
            props.error ? "form-field__control--error" : ""
          ].join(" ")}
          {...props.inputProps}
        />
      )}

      {props.error ? (
        <span className="form-field__error">
          {props.error}
        </span>
      ) : props.hint ? (
        <span className="form-field__hint">
          {props.hint}
        </span>
      ) : null}
    </label>
  );
}