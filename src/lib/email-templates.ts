import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * Email template utilities for loading and rendering HTML templates
 */
export class EmailTemplateService {
  private static templateCache: Map<string, string> = new Map();
  private static readonly TEMPLATES_DIR = path.join(process.cwd(), 'src', 'templates');

  /**
   * Loads an email template from the filesystem with caching
   * @param templateName - The name of the template file (without extension)
   * @returns The template content as a string
   */
  static loadTemplate(templateName: string): string {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    try {
      const templatePath = path.join(this.TEMPLATES_DIR, `${templateName}.html`);
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      this.templateCache.set(templateName, templateContent);
      return templateContent;
    } catch (error) {
      logger.error('Failed to load email template', {
        templateName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to load email template: ${templateName}`);
    }
  }

  /**
   * Renders a template with the provided variables
   * @param templateName - The name of the template file
   * @param variables - Object containing template variables
   * @returns The rendered template as a string
   */
  static renderTemplate(templateName: string, variables: Record<string, string>): string {
    const template = this.loadTemplate(templateName);
    
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  /**
   * Clears the template cache (useful for testing or hot reloading)
   */
  static clearCache(): void {
    this.templateCache.clear();
  }
}

/**
 * Convenience function to render the OTP email template
 * @param otp - The OTP code to include in the email
 * @returns The rendered HTML content
 */
export function renderOTPEmailTemplate(otp: string): string {
  return EmailTemplateService.renderTemplate('otp-email', { OTP: otp });
}
