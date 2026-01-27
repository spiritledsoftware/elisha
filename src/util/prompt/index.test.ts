import { describe, expect, it } from 'bun:test';
import { Prompt } from '~/util/prompt';

describe('Prompt', () => {
  describe('when', () => {
    it('returns tContent when condition is true', () => {
      const result = Prompt.when(true, 'enabled content', 'disabled content');
      expect(result).toBe('enabled content');
    });

    it('returns fContent when condition is false and fContent provided', () => {
      const result = Prompt.when(false, 'enabled content', 'disabled content');
      expect(result).toBe('disabled content');
    });

    it('returns empty string when condition is false and no fContent', () => {
      const result = Prompt.when(false, 'enabled content');
      expect(result).toBe('');
    });

    it('handles empty string as tContent', () => {
      const result = Prompt.when(true, '', 'fallback');
      expect(result).toBe('');
    });

    it('handles empty string as fContent', () => {
      const result = Prompt.when(false, 'content', '');
      expect(result).toBe('');
    });
  });

  describe('code', () => {
    it('wraps code in triple backticks', () => {
      const result = Prompt.code('const x = 1;');
      expect(result).toBe('```\nconst x = 1;\n```');
    });

    it('includes language when provided', () => {
      const result = Prompt.code('const x = 1;', 'typescript');
      expect(result).toBe('```typescript\nconst x = 1;\n```');
    });

    it('works with empty language (no language tag)', () => {
      const result = Prompt.code('print("hello")', '');
      expect(result).toBe('```\nprint("hello")\n```');
    });

    it('handles multi-line code', () => {
      const code = 'function foo() {\n  return 42;\n}';
      const result = Prompt.code(code, 'js');
      expect(result).toBe('```js\nfunction foo() {\n  return 42;\n}\n```');
    });

    it('handles empty code string', () => {
      const result = Prompt.code('', 'ts');
      expect(result).toBe('```ts\n\n```');
    });
  });

  describe('dedent', () => {
    it('removes common leading indentation', () => {
      const input = '    line1\n    line2\n    line3';
      const result = Prompt.dedent(input);
      expect(result).toBe('line1\nline2\nline3');
    });

    it('preserves relative indentation', () => {
      const input = '    line1\n      nested\n    line3';
      const result = Prompt.dedent(input);
      expect(result).toBe('line1\n  nested\nline3');
    });

    it('handles empty lines correctly', () => {
      const input = '    line1\n\n    line3';
      const result = Prompt.dedent(input);
      expect(result).toBe('line1\n\nline3');
    });

    it('returns original string if no common indent', () => {
      const input = 'line1\n  line2\nline3';
      const result = Prompt.dedent(input);
      expect(result).toBe('line1\n  line2\nline3');
    });

    it('handles tabs as indentation', () => {
      const input = '\t\tline1\n\t\tline2';
      const result = Prompt.dedent(input);
      expect(result).toBe('line1\nline2');
    });

    it('handles mixed indent levels correctly', () => {
      const input = '  base\n    deeper\n  base again';
      const result = Prompt.dedent(input);
      expect(result).toBe('base\n  deeper\nbase again');
    });

    it('handles single line with indent', () => {
      const input = '    single line';
      const result = Prompt.dedent(input);
      expect(result).toBe('single line');
    });

    it('handles string with only empty lines', () => {
      const input = '\n\n\n';
      const result = Prompt.dedent(input);
      expect(result).toBe('\n\n\n');
    });

    it('handles empty string', () => {
      const result = Prompt.dedent('');
      expect(result).toBe('');
    });
  });

  describe('template', () => {
    it('filters out null values', () => {
      const value = null;
      const result = Prompt.template`before${value}after`;
      expect(result).toBe('beforeafter');
    });

    it('filters out undefined values', () => {
      const value = undefined;
      const result = Prompt.template`before${value}after`;
      expect(result).toBe('beforeafter');
    });

    it('filters out empty string values', () => {
      const value = '';
      const result = Prompt.template`before${value}after`;
      expect(result).toBe('beforeafter');
    });

    it('preserves non-empty string values', () => {
      const value = 'middle';
      const result = Prompt.template`before ${value} after`;
      expect(result).toBe('before middle after');
    });

    it('converts numbers to strings', () => {
      const value = 42;
      const result = Prompt.template`count: ${value}`;
      expect(result).toBe('count: 42');
    });

    it('preserves indentation for multi-line interpolated values', () => {
      const multiLine = 'line1\nline2\nline3';
      // Interpolated values get indent from their position in the template
      // dedent() removes the common 8-space indent, preserving relative indentation
      const result = Prompt.template`
        <section>
          ${multiLine}
        </section>
      `;
      // dedent removes 8-space common indent, leaving 2-space relative indent for content
      expect(result).toBe('<section>\n  line1\n  line2\n  line3\n</section>');
    });

    it('collapses 3+ newlines into 2', () => {
      const result = Prompt.template`line1\n\n\n\nline2`;
      expect(result).toBe('line1\n\nline2');
    });

    it('preserves exactly 2 newlines', () => {
      const result = Prompt.template`line1\n\nline2`;
      expect(result).toBe('line1\n\nline2');
    });

    it('trims leading/trailing whitespace', () => {
      const result = Prompt.template`
        content here
      `;
      expect(result).toBe('content here');
    });

    it('applies dedent to final result', () => {
      // dedent() finds minimum indent (8 spaces) and removes it from all lines
      // This preserves relative indentation while removing common leading whitespace
      const result = Prompt.template`
        <root>
          <child>content</child>
        </root>
      `;
      expect(result).toBe('<root>\n  <child>content</child>\n</root>');
    });

    it('handles multiple interpolations', () => {
      const a = 'first';
      const b = 'second';
      const c = 'third';
      const result = Prompt.template`${a}, ${b}, ${c}`;
      expect(result).toBe('first, second, third');
    });

    it('handles mixed null/undefined/empty with valid values', () => {
      const valid = 'valid';
      const empty = '';
      const nullVal = null;
      const undef = undefined;
      const result = Prompt.template`${valid}${empty}${nullVal}${undef}end`;
      expect(result).toBe('validend');
    });

    it('works with Prompt.when for conditional sections', () => {
      const enabled = true;
      const disabled = false;
      const result = Prompt.template`
        <doc>
          ${Prompt.when(enabled, '<enabled/>')}
          ${Prompt.when(disabled, '<disabled/>')}
        </doc>
      `;
      // Empty string from disabled when leaves the indent on that line
      // dedent() removes 8-space common indent, preserving 2-space relative indent
      expect(result).toBe('<doc>\n  <enabled/>\n  \n</doc>');
    });

    it('handles deeply nested indentation', () => {
      const inner = 'nested\n  deeper';
      const result = Prompt.template`
        <outer>
          <middle>
            ${inner}
          </middle>
        </outer>
      `;
      // Interpolated content gets indent from position, subsequent lines get same indent added
      // dedent() removes 8-space common indent, preserving relative indentation
      expect(result).toBe(
        '<outer>\n  <middle>\n    nested\n      deeper\n  </middle>\n</outer>',
      );
    });

    it('handles empty template', () => {
      const result = Prompt.template``;
      expect(result).toBe('');
    });

    it('handles template with only whitespace', () => {
      const result = Prompt.template`   
      
      `;
      expect(result).toBe('');
    });

    it('handles boolean values', () => {
      const result = Prompt.template`enabled: ${true}, disabled: ${false}`;
      expect(result).toBe('enabled: true, disabled: false');
    });

    it('handles zero as a valid value', () => {
      const result = Prompt.template`count: ${0}`;
      expect(result).toBe('count: 0');
    });
  });
});
