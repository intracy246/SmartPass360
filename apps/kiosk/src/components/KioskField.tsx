import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

type CommonProps = {
  label: string;
  required?: boolean;
  hint?: string;
};

type InputProps = CommonProps & {
  type?: "input";
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
};

type SelectProps = CommonProps & {
  type: "select";
  children: ReactNode;
  selectProps?: SelectHTMLAttributes<HTMLSelectElement>;
};

type TextareaProps = CommonProps & {
  type: "textarea";
  textareaProps?: TextareaHTMLAttributes<HTMLTextAreaElement>;
};

type KioskFieldProps =
  | InputProps
  | SelectProps
  | TextareaProps;

export function KioskField(
  props: KioskFieldProps
) {
  return (
    <label className="kiosk-field">
      <span className="kiosk-field__label">
        {props.label}

        {props.required && (
          <strong aria-hidden="true">*</strong>
        )}
      </span>

      {props.type === "select" ? (
        <select
          required={props.required}
          {...props.selectProps}
        >
          {props.children}
        </select>
      ) : props.type === "textarea" ? (
        <textarea
          required={props.required}
          {...props.textareaProps}
        />
      ) : (
        <input
          required={props.required}
          {...props.inputProps}
        />
      )}

      {props.hint && (
        <small>{props.hint}</small>
      )}
    </label>
  );
}