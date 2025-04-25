"use client";
import React from "react";
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import {
  FormFieldWrapper,
  FormFieldWrapperProps,
} from "@/components/FormFieldWrapper";
import { FieldValues, FieldPath } from "react-hook-form";

export interface FormFieldTextareaProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> extends Omit<FormFieldWrapperProps<TFieldValues, TName>, "children"> {
  placeholder?: string;
  disabled?: boolean;
}

export function FormFieldTextarea<
  TFieldValues extends FieldValues = FieldValues,
>({
  placeholder,
  disabled,
  ...wrapperProps
}: FormFieldTextareaProps<TFieldValues>) {
  return (
    <FormFieldWrapper<TFieldValues, any> {...wrapperProps}>
      {(field) => (
        <Textarea placeholder={placeholder} disabled={disabled} {...field} />
      )}
    </FormFieldWrapper>
  );
}
