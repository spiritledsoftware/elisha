export namespace Prompt {
  /**
   * Returns tContent if condition is true, else fContent or empty string.
   * @abstract
   * @example
   * ```ts
   * const section = Prompt.when(isEnabled, '## Enabled Section', '## Disabled Section');
   * ```
   */
  export const when = (
    condition: boolean,
    tContent: string,
    fContent?: string,
  ): string => dedent(condition ? tContent : (fContent ?? ''));

  /**
   * Formats a code block with optional language for syntax highlighting.
   *
   * @example
   * ```ts
   * const codeBlock = Prompt.code('console.log("Hello, world!");', 'ts');
   * ```
   */
  export const code = (code: string, language = ''): string =>
    dedent(`\`\`\`${language}\n${code}\n\`\`\``);

  /**
   * Tagged template literal for composing prompts with embedded expressions.
   *
   * Features:
   * - Filters out null, undefined, and empty string values
   * - Preserves indentation for multi-line interpolated values
   * - Removes common leading indentation (dedent)
   * - Collapses 3+ newlines into 2
   * - Trims leading/trailing whitespace
   *
   * @example
   * ```ts
   * const agentList = `| explorer | searches code |
   * | executor | writes code |`;
   *
   * const prompt = Prompt.template`
   *     <agents>
   *       ${agentList}
   *     </agents>
   *
   *     ${Prompt.when(hasFeature, '## Optional Section')}
   * `;
   * // Output:
   * // <agents>
   * //   | explorer | searches code |
   * //   | executor | writes code |
   * // </agents>
   * ```
   */
  export const template = (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): string => {
    let result = '';

    for (let i = 0; i < strings.length; i++) {
      result += strings[i];

      if (i < values.length) {
        const value = values[i];

        if (value !== null && value !== undefined && value !== '') {
          const stringValue = String(value);

          // Find indent: whitespace after last newline in preceding string
          const preceding = strings[i] ?? '';
          const lastNewline = preceding.lastIndexOf('\n');
          let indent = '';
          if (lastNewline !== -1) {
            indent =
              preceding.slice(lastNewline + 1).match(/^[ \t]*/)?.[0] ?? '';
          }

          // Apply indent to all lines except the first (already positioned)
          const indentedValue = stringValue
            .split('\n')
            .map((line, idx) => (idx === 0 ? line : indent + line))
            .join('\n');

          result += indentedValue;
        }
      }
    }

    return dedent(result.replace(/\n{3,}/g, '\n\n').trim());
  };

  /**
   * Remove common leading indentation from all lines.
   * Finds the minimum indent across non-empty lines and strips it.
   */
  export const dedent = (str: string): string => {
    const lines = str.split('\n');

    // Find minimum indent (ignoring empty lines)
    const minIndent = lines
      .filter((line) => line.trim().length > 0)
      .reduce((min, line) => {
        const indent = line.match(/^[ \t]*/)?.[0].length ?? 0;
        return Math.min(min, indent);
      }, Infinity);

    if (minIndent === 0 || minIndent === Infinity) return str;

    // Remove that indent from all lines
    return lines.map((line) => line.slice(minIndent)).join('\n');
  };
}
