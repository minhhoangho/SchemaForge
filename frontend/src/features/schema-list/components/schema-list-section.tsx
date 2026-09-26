import type { JSX, ReactNode } from "react";
import { useId } from "react";

type SchemaListSectionProps = {
  readonly title: string;
  readonly children: ReactNode;
};

export function SchemaListSection({
  title,
  children,
}: SchemaListSectionProps): JSX.Element {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="col-span-2 flex flex-col gap-3"
    >
      <h2 id={headingId} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
