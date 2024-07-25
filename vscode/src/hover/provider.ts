import { HoverProvider, Hover, window, ProviderResult, MarkdownString, Uri } from 'vscode';
import { KEYBINDING_DISPLAY } from '../constants';
import { getHighlightedText } from '../helpers/utils';

export default class LanguagesHoverProvider implements HoverProvider {
  provideHover(): ProviderResult<Hover> {
    return new Promise(async (resolve) => {
      const editor = window.activeTextEditor;
      if (editor == null) {
        return resolve(null);
      }

      const { highlighted } = getHighlightedText(editor);
      if (!highlighted) {
        return resolve(null);
      }

      const writeCommandUri = Uri.parse('command:th.code.comment.generate');
      const writeCommandUri1 = Uri.parse('command:th.code.interpretation.generate');
      // const showcaseDocstring = new MarkdownString(`[✍️ Generate docs (${KEYBINDING_DISPLAY()})](${writeCommandUri})`, true);
      const showcaseDocstring = new MarkdownString(
        `[生成注释](${writeCommandUri})<br/>[解释代码](${writeCommandUri1})`,
        true
      );
      showcaseDocstring.supportHtml = true;
      showcaseDocstring.isTrusted = true;
      return resolve(new Hover([showcaseDocstring]));
    });
  }
}
