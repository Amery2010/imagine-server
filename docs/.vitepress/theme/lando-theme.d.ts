/**
 * Type declarations for @lando/vitepress-theme-default-plus
 * This package doesn't provide its own type definitions
 */

declare module "@lando/vitepress-theme-default-plus" {
  import type { Theme } from "vitepress";
  const VPLTheme: Theme;
  export default VPLTheme;
}

declare module "@lando/vitepress-theme-default-plus/config" {
  import type { UserConfig } from "vitepress";
  export function defineConfig(config: UserConfig): UserConfig;
}
