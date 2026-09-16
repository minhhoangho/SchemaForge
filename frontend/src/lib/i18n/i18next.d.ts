import type { DEFAULT_NAMESPACE, enResources } from "./resources";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof DEFAULT_NAMESPACE;
    resources: typeof enResources;
  }
}
