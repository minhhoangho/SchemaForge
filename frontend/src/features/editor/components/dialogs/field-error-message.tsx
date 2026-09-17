import type { JSX } from "react";

import type { FieldErrorView } from "./relation-dialog-fields";

type FieldErrorMessageProps = {
  readonly view: FieldErrorView;
};

/**
 * The messages under a field. A validation message is announced by the
 * dialog's polite status region, so it carries no role here; the error core
 * returned on confirmation is an alert, since it appears right after the user
 * pressed the button.
 */
export function FieldErrorMessage({
  view,
}: FieldErrorMessageProps): JSX.Element {
  return (
    <>
      {view.validationText !== undefined && (
        <p id={view.validationId} className="text-sm text-destructive">
          {view.validationText}
        </p>
      )}
      {view.submitText !== undefined && (
        <p id={view.submitId} role="alert" className="text-sm text-destructive">
          {view.submitText}
        </p>
      )}
    </>
  );
}
