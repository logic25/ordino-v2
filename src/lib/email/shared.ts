/**
 * Shared helpers used by every email-HTML builder.
 * Keeps style/template-variable logic in one place so the
 * 3 builders (proposal, change order, branded) stay in sync.
 */

export interface EmailStyleConfig {
  accentColor?: string;
  accentTextColor?: string;
  accentForeground?: string;
  fontFamily?: string;
  buttonRadius?: string;
  bodyColor?: string;
  headingColor?: string;
  bodyFontSize?: string;
}

export const DEFAULT_EMAIL_STYLE: Required<EmailStyleConfig> = {
  accentColor: "#d7df23",
  accentTextColor: "#d7df23",
  accentForeground: "#1f2937",
  fontFamily: "Arial, Helvetica, sans-serif",
  buttonRadius: "8px",
  bodyColor: "#334155",
  headingColor: "#1e293b",
  bodyFontSize: "15px",
};

/** Snake_case settings shape persisted in company_settings.email_style. */
export interface SavedEmailStyle {
  accent_color?: string;
  accent_text_color?: string;
  font_family?: string;
  button_radius?: string;
  body_color?: string;
  heading_color?: string;
  body_font_size?: string;
}

/**
 * Resolve a snake_case persisted style into the camelCase config used by builders.
 * Single source of truth — every caller must use this.
 */
export function resolveEmailStyle(saved?: SavedEmailStyle | null): EmailStyleConfig {
  return {
    accentColor: saved?.accent_color || DEFAULT_EMAIL_STYLE.accentColor,
    accentTextColor: saved?.accent_text_color || saved?.accent_color || DEFAULT_EMAIL_STYLE.accentTextColor,
    accentForeground: DEFAULT_EMAIL_STYLE.accentForeground,
    fontFamily: saved?.font_family || DEFAULT_EMAIL_STYLE.fontFamily,
    buttonRadius: saved?.button_radius || DEFAULT_EMAIL_STYLE.buttonRadius,
    bodyColor: saved?.body_color || DEFAULT_EMAIL_STYLE.bodyColor,
    headingColor: saved?.heading_color || DEFAULT_EMAIL_STYLE.headingColor,
    bodyFontSize: saved?.body_font_size || DEFAULT_EMAIL_STYLE.bodyFontSize,
  };
}

/** Fill in any missing fields on a partial style with defaults. */
export function fillStyleDefaults(style?: EmailStyleConfig): Required<EmailStyleConfig> {
  return {
    accentColor: style?.accentColor ?? DEFAULT_EMAIL_STYLE.accentColor,
    accentTextColor: style?.accentTextColor ?? style?.accentColor ?? DEFAULT_EMAIL_STYLE.accentTextColor,
    accentForeground: style?.accentForeground ?? DEFAULT_EMAIL_STYLE.accentForeground,
    fontFamily: style?.fontFamily ?? DEFAULT_EMAIL_STYLE.fontFamily,
    buttonRadius: style?.buttonRadius ?? DEFAULT_EMAIL_STYLE.buttonRadius,
    bodyColor: style?.bodyColor ?? DEFAULT_EMAIL_STYLE.bodyColor,
    headingColor: style?.headingColor ?? DEFAULT_EMAIL_STYLE.headingColor,
    bodyFontSize: style?.bodyFontSize ?? DEFAULT_EMAIL_STYLE.bodyFontSize,
  };
}

/** Replace {{KEY}} placeholders in a template string. */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>,
): string {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.split(`{{${key}}}`).join(value),
    template,
  );
}
