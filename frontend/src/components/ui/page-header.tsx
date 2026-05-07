import { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? <span className="text-xs uppercase tracking-[0.35em] text-gold">{eyebrow}</span> : null}
        <h1 className="mt-3 text-4xl font-extrabold leading-tight text-text">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

