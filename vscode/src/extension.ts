import * as vscode from 'vscode';
import axios, { AxiosError } from 'axios';
import LanguagesHoverProvider from './hover/provider';
import {
  monitorWorkerStatus,
  getDocStyleConfig,
  getCustomConfig,
  getHighlightedText,
  getWidth,
} from './helpers/utils';
import {
  changeProgressColor,
  removeProgressColor,
  displaySignInView,
  askForFeedbackNotification,
  shareNotification,
} from './helpers/ui';
import { DOCS_WRITE, DOCS_WRITE_NO_SELECTION, USERID } from './helpers/api';
import { configUserSettings } from './helpers/ui';
import { createProgressTree } from './options/progress';
import { AuthService, initializeAuth, openPortal, updateTrees, upgrade } from './helpers/auth';
import { hotkeyConfigProperty, KEYBINDING_DISPLAY } from './constants';
import { chatApi, Prompts } from './api/chat';
import CodeAssistant from './utils/codeAssistant';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import inlineCompletionProvider from './utils/codeGeeX/provider/inlineCompletionProvider';

const LANGUAGES_SUPPORT = [
  'php',
  'javascript',
  'typescript',
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'dart',
  'ruby',
  'go',
  'rust',
];
axios.defaults.timeout = 5 * 60 * 1000;
let g_isLoading = false;
let originalColor: string | vscode.ThemeColor | undefined;
let myStatusBarItem: vscode.StatusBarItem;
export function activate(context: vscode.ExtensionContext) {
  // All active events can be put here
  const authService = new AuthService(context.globalState);
  configUserSettings();
  initializeAuth(authService);

  // Detect changes for progress
  vscode.workspace.onDidSaveTextDocument(() => {
    createProgressTree();
  });
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor == null) {
      return;
    }
    createProgressTree();
  });

  const codeCommentGenerater = vscode.commands.registerCommand(
    'th.code.comment.generate',
    async () => {
      changeProgressColor();
      const editor = vscode.window.activeTextEditor;
      if (editor == null) {
        removeProgressColor();
        return;
      }

      const { languageId, getText, fileName } = editor.document;

      const { selection, highlighted } = getHighlightedText(editor);
      let location: number | null = null;
      let line: vscode.TextLine | null = null;

      // Used for cursor placement
      const startLine = selection.start.line;

      if (!highlighted) {
        removeProgressColor();
        let document = editor.document;
        let curPos = editor.selection.active;
        location = document.offsetAt(curPos);
        line = document.lineAt(curPos);
        if (line.isEmptyOrWhitespace) {
          vscode.window.showErrorMessage(`请选择一行代码并再次输入${KEYBINDING_DISPLAY()}`);
          return;
        }
        if (!LANGUAGES_SUPPORT.includes(languageId)) {
          vscode.window.showErrorMessage(`请选择代码并再次输入${KEYBINDING_DISPLAY()}`);
          return;
        }
      }

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '生成说明文档中',
        },
        async () => {
          const docsPromise = new Promise(async (resolve, _) => {
            try {
              const WRITE_ENDPOINT = highlighted ? DOCS_WRITE : DOCS_WRITE_NO_SELECTION;
              const {
                data: { id },
              } = await axios.post(WRITE_ENDPOINT, {
                languageId,
                fileName,
                commented: true,
                userId: USERID,
                email: authService.getEmail(),
                docStyle: getDocStyleConfig(),
                custom: getCustomConfig(),
                source: 'vscode',
                context: getText(),
                width: line
                  ? getWidth(line.firstNonWhitespaceCharacterIndex)
                  : getWidth(selection.start.character),
                // code to use for selected
                code: highlighted,
                // location for no-selection
                location,
                line: line?.text,
              });

              const {
                docstring,
                position,
                feedbackId,
                cursorMarker,
                // for feedback
                shouldShowFeedback,
                shouldShowShare,
              } = await monitorWorkerStatus(id);
              vscode.commands.executeCommand('docs.insert', {
                position,
                content: docstring,
                selection: selection,
              });
              resolve('生成完成');
              removeProgressColor();

              if (cursorMarker != null) {
                const start = new vscode.Position(
                  cursorMarker.line + startLine,
                  cursorMarker.character
                );
                editor.selection = new vscode.Selection(start, start);
                vscode.window.showInformationMessage(cursorMarker.message);
              }

              if (shouldShowFeedback) {
                const feedbackScore = await askForFeedbackNotification(feedbackId);

                if (feedbackScore === 1 && shouldShowShare) {
                  shareNotification();
                }
              }
            } catch (err: AxiosError | any) {
              resolve('Error');
              removeProgressColor();

              const { requiresAuth, requiresUpgrade, message, button } = err?.response?.data || {};

              if (requiresAuth) {
                displaySignInView(message, button);
                return;
              } else if (requiresUpgrade) {
                const REFER_BUTTON = '💬 Refer friend to extend quota';
                const UPGRADE_BUTTON = '🔐 Try premium for free';
                const upgradeResponse = await vscode.window.showInformationMessage(
                  err.response.data.message,
                  REFER_BUTTON,
                  UPGRADE_BUTTON
                );
                if (upgradeResponse === UPGRADE_BUTTON) {
                  upgrade(authService.getEmail());
                } else if (upgradeResponse === REFER_BUTTON) {
                  vscode.commands.executeCommand('docs.invite', authService, 'community', false);
                }

                return;
              }

              const errMessage = err?.response?.data?.error;
              if (errMessage != null) {
                vscode.window.showErrorMessage(errMessage);
              } else {
                vscode.window.showErrorMessage('生成文档时发生错误');
              }
            }
          });

          await docsPromise;
        }
      );
    }
  );

  const codeInterpretationGenerater = vscode.commands.registerCommand(
    'th.code.interpretation.generate',
    async () => {
      changeProgressColor();
      const editor = vscode.window.activeTextEditor;
      if (editor == null) {
        removeProgressColor();
        return;
      }

      const { languageId, getText, fileName: filePath } = editor.document;
      const originContent = editor.document.getText();
      const fileNameArr = filePath.split('\\');
      const fileName = fileNameArr[fileNameArr.length - 1];

      const { selection, highlighted } = getHighlightedText(editor);
      let location: number | null = null;
      let line: vscode.TextLine | null = null;

      if (!highlighted) {
        removeProgressColor();
        let document = editor.document;
        let curPos = editor.selection.active;
        location = document.offsetAt(curPos);
        line = document.lineAt(curPos);
        if (line.isEmptyOrWhitespace) {
          vscode.window.showErrorMessage(`请选择代码块`);
          return;
        }
        if (!LANGUAGES_SUPPORT.includes(languageId)) {
          vscode.window.showErrorMessage(`暂不支持${languageId}语言`);
          return;
        }
      } else if (highlighted.length > 9000) {
        vscode.window.showErrorMessage(`暂不支持内容超过9000字符，请重新选择`);
        return;
      }
      // Used for cursor placement
      // selection.
      const startLine = selection.start.line;
      const endLine = selection.end.line;
      const selectionTextContent = editor.document.getText(selection);

      const abortController = new AbortController();
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '生成逐行注释中',
          cancellable: true,
        },
        async (progress, cancelToken) => {
          const docsPromise = new Promise(async (resolve, reject) => {
            try {
              console.log('selectionTextContent', selectionTextContent);

              const nameArr = editor.document.fileName.split('\\');

              let response = CodeAssistant.explain(
                nameArr[nameArr.length - 1],
                selectionTextContent,
                {
                  signal: abortController.signal,
                }
              );
              cancelToken.onCancellationRequested(() => {
                // response.cancel('Cancel');
                abortController.abort('Cancel');
              });

              const output = await response;

              const beforeSelection = originContent.substring(
                0,
                editor.document.offsetAt(selection.start)
              );
              const afterSelection = originContent.substring(
                editor.document.offsetAt(selection.end)
              );

              // debugger;
              // const whiteSpacesCount = selectionTextContent.match(/^(\s+)/)?.[1]?.length || 0;
              // debugger;
              // output
              //   .split('\n')
              //   .map((item) => ' '.repeat(whiteSpacesCount) + item)
              //   .join('\n');
              const modifiedContent = beforeSelection + output + afterSelection;

              const tempPath = `${os.tmpdir()}\\.thCodeTool`;
              const tempFilePath = `${tempPath}\\${filePath.replace(/[\\:]/g, '_')}`;
              await fs.mkdir(tempPath, { recursive: true });
              await fs.writeFile(tempFilePath, modifiedContent, {
                flag: 'w+',
              });
              const modifiedDocument = await vscode.workspace.openTextDocument(tempFilePath);
              // debugger;
              // const modifiedEditor = await vscode.window.showTextDocument(modifiedDocument, {
              //   preview: true,
              // });

              let diffEditor;
              // vscode.window.onDidChangeWindowState(
              //   function onDidChangeActiveTextEditor(ed) {
              //     // ed.document.isClosed
              //       debugger;
              //     // if (ed !== diffEditor) {
              //     // }
              //   },
              //   null,
              //   context.subscriptions
              // );
              // vscode.workspace.onDidCloseTextDocument(
              //   (ed) => {
              //     debugger;
              //     if (ed !== modifiedDocument) {
              //     }
              //   },
              //   null,
              //   context.subscriptions
              // );
              // 显示差异
              await vscode.commands
                .executeCommand(
                  'vscode.diff',
                  modifiedDocument.uri,
                  editor.document.uri,
                  'Diff View: ' + fileName,
                  {
                    preview: true,
                  }
                )
                .then(
                  (success) => console.log('Diff shown successfully.'),
                  (error) => console.error('Error showing diff:', error)
                );
              diffEditor = vscode.window.activeTextEditor;

              resolve('生成完成');
              removeProgressColor();

              // const {
              //   docstring,
              //   position,
              //   feedbackId,
              //   cursorMarker,
              //   // for feedback
              //   shouldShowFeedback,
              //   shouldShowShare,
              // } = await monitorWorkerStatus(id);

              // vscode.commands.executeCommand('docs.insert', {
              //   position,
              //   content: docstring,
              //   selection: selection,
              // });
              // resolve('生成完成');
              // removeProgressColor();

              // if (cursorMarker != null) {
              //   const start = new vscode.Position(
              //     cursorMarker.line + startLine,
              //     cursorMarker.character
              //   );
              //   editor.selection = new vscode.Selection(start, start);
              //   vscode.window.showInformationMessage(cursorMarker.message);
              // }

              // if (shouldShowFeedback) {
              //   const feedbackScore = await askForFeedbackNotification(feedbackId);

              //   if (feedbackScore === 1 && shouldShowShare) {
              //     shareNotification();
              //   }
              // }
            } catch (err: AxiosError | any) {
              resolve('Error');
              removeProgressColor();
              if (err?.message === 'Cancel') {
                vscode.window.showInformationMessage('已取消');
                return;
              }

              const { requiresAuth, requiresUpgrade, message, button } = err?.response?.data || {};

              if (requiresAuth) {
                displaySignInView(message, button);
                return;
              } else if (requiresUpgrade) {
                const REFER_BUTTON = '💬 Refer friend to extend quota';
                const UPGRADE_BUTTON = '🔐 Try premium for free';
                const upgradeResponse = await vscode.window.showInformationMessage(
                  err.response.data.message,
                  REFER_BUTTON,
                  UPGRADE_BUTTON
                );
                if (upgradeResponse === UPGRADE_BUTTON) {
                  upgrade(authService.getEmail());
                } else if (upgradeResponse === REFER_BUTTON) {
                  vscode.commands.executeCommand('docs.invite', authService, 'community', false);
                }

                return;
              }

              const errMessage = err?.response?.data?.error;
              if (errMessage != null) {
                vscode.window.showErrorMessage(errMessage);
              } else {
                vscode.window.showErrorMessage('生成逐行注释时发生错误');
              }
            }
          });

          await docsPromise;
        }
      );
    }
  );

  // const codeCompletionProvider = vscode.languages.registerCompletionItemProvider(
  //   {
  //     scheme: 'file',
  //   },
  //   {
  //     provideCompletionItems(document, position, token, context) {
  //       const linePrefix = document.lineAt(position).text.substring(0, position.character);

  //       // 简单的代码补全示例，根据前缀提供建议
  //       if (linePrefix.startsWith('consol.')) {
  //         const suggestions = ['log', 'warn', 'error', 'info', 'debug'].map((label) => {
  //           // 使用 CompletionItemKind.Snippet 创建代码片段
  //           const completionItem = new vscode.CompletionItem(
  //             label,
  //             vscode.CompletionItemKind.Snippet
  //           );
  //           // 设置代码片段内容，${1} 表示第一个占位符
  //           completionItem.insertText = new vscode.SnippetString(`console.${label}($1);`);
  //           return completionItem;
  //         });
  //         // 使用 CompletionList 将多个建议组合在一起
  //         return new vscode.CompletionList(suggestions);
  //       }

  //       return []; // 如果没有匹配到，返回空数组
  //     },
  //     resolveCompletionItem(
  //       item: vscode.CompletionItem,
  //       token: vscode.CancellationToken
  //     ): vscode.ProviderResult<vscode.CompletionItem> {
  //       debugger;
  //       return item;
  //     },
  //   }
  // );

  const inlineCodeCompletionProvider = inlineCompletionProvider(
    g_isLoading,
    myStatusBarItem,
    false,
    originalColor,
    context
  );

  // const lastTime = Date.now();
  // const inlineCodeCompletionProvider: vscode.InlineCompletionItemProvider = {
  //   provideInlineCompletionItems: async (document, position, context, token) => {
  //     debugger;
  //     const content = vscode.window.activeTextEditor.document.getText();
  //     let cursorPosition = vscode.window.activeTextEditor.selection.active;

  //     const code = await CodeAssistant.codeCompletion(content, cursorPosition.line);

  //     return {
  //       items: [],
  //     };
  //   },
  // };
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      inlineCodeCompletionProvider
    )
  );
  const insert = vscode.commands.registerCommand(
    'docs.insert',
    async ({
      position,
      content,
      selection,
    }: {
      position: 'above' | 'belowStartLine';
      content: string;
      selection: vscode.Selection;
    }) => {
      const editor = vscode.window.activeTextEditor;
      if (editor == null) {
        return;
      }

      if (position === 'belowStartLine') {
        const start = selection.start.line;
        const startLine = editor.document.lineAt(start);

        const tabbedDocstring = content
          .split('\n')
          .map((line: string) => `\t${line}`)
          .join('\n');
        const snippet = new vscode.SnippetString(`\n${tabbedDocstring}`);
        editor.insertSnippet(snippet, startLine.range.end);
      } else if (position === 'above') {
        const snippet = new vscode.SnippetString(`${content}\n`);
        let position;
        if (
          selection.start.line == selection.end.line &&
          selection.start.character == selection.end.character
        ) {
          let document = editor.document;
          const curPos = editor.selection.active;
          const desiredLine = document.lineAt(curPos);
          const lineNum: number = desiredLine.range.start.line;
          position = new vscode.Position(lineNum, desiredLine.firstNonWhitespaceCharacterIndex);
        } else {
          position = selection.start;
        }
        editor.insertSnippet(snippet, position);
      }
    }
  );

  const updateStyleConfig = vscode.commands.registerCommand(
    'docs.styleConfig',
    async (newStyle) => {
      if (!newStyle) {
        return;
      }
      await vscode.workspace.getConfiguration('docwriter').update('style', newStyle);
      updateTrees(authService);
    }
  );
  const updateHotkeyConfig = vscode.commands.registerCommand(
    'docs.hotkeyConfig',
    async (newHotkey) => {
      if (!newHotkey) {
        return;
      }
      await vscode.workspace
        .getConfiguration('docwriter')
        .update(hotkeyConfigProperty(), newHotkey);
      updateTrees(authService);
    }
  );
  const updateLanguageConfig = vscode.commands.registerCommand(
    'docs.languageConfig',
    async (newLanguage) => {
      if (!newLanguage) {
        return;
      }
      await vscode.workspace.getConfiguration('docwriter').update('language', newLanguage);
      updateTrees(authService);
    }
  );

  const showUpgradeInformationMessage = vscode.commands.registerCommand(
    'docs.upgradeInfo',
    async (message, button) => {
      if (authService.getEmail() == null) {
        displaySignInView('Sign in and upgrade to unlock feature', '🔐 Sign in');
        return;
      }

      const clickedOnButton = await vscode.window.showInformationMessage(message, button);
      if (clickedOnButton) {
        upgrade(authService.getEmail());
      }
    }
  );

  const portalCommand = vscode.commands.registerCommand('docs.portal', async () => {
    openPortal(authService.getEmail());
  });

  const languagesProvider = LANGUAGES_SUPPORT.map((language) => {
    return vscode.languages.registerHoverProvider(language, new LanguagesHoverProvider());
  });

  context.subscriptions.push(
    codeCommentGenerater,
    codeInterpretationGenerater,
    insert,
    updateStyleConfig,
    updateHotkeyConfig,
    updateLanguageConfig,
    showUpgradeInformationMessage,
    portalCommand
  );
  context.subscriptions.push(...languagesProvider);
}
