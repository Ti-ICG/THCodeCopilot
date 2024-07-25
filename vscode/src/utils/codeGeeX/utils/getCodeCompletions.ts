import axios from 'axios';
import * as https from 'https';
import * as vscode from 'vscode';
import { apiHref } from '../localconfig';
import { temp, topp, topk, generationPreference } from '../param/configures';
import { getEndData, getStartData } from './statisticFunc';
import { openaiCompletions } from '../../../api/modules/langchain-chatchat_v3';
import { Client } from '../../../libs/@gradio/client';

export type GetCodeCompletions = {
  completions: Array<string>;
  commandid: string;
};

let abortController: AbortController;

export function getCodeCompletions(
  prompt: string,
  num: number,
  lang: string,
  apiKey: string,
  apiSecret: string,
  mode: string
): Promise<GetCodeCompletions> {
  let API_URL = '';
  if (mode === 'prompt') {
    API_URL = `${apiHref}/multilingual_code_generate_block`;
  } else if (mode === 'interactive') {
    API_URL = `${apiHref}/multilingual_code_generate_adapt`;
  } else {
    if (generationPreference === 'line by line') {
      API_URL = `${apiHref}/multilingual_code_generate`;
    } else {
      API_URL = `${apiHref}/multilingual_code_generate_adapt`;
    }
  }
  return new Promise(async (resolve, reject) => {
    let n = 0;
    if (prompt.length <= 300) {
      n = 3;
    } else if (prompt.length > 600 && prompt.length <= 900) {
      n = 2;
    } else if (prompt.length > 900 && prompt.length <= 1200) {
      n = 1;
    } else if (prompt.length > 1200) {
      prompt = prompt.slice(prompt.length - 1200);
      n = 1;
    }
    let payload = {};
    if (lang.length == 0) {
      payload = {
        prompt: prompt,
        n: num,
        apikey: apiKey,
        apisecret: apiSecret,
        temperature: temp,
        top_p: topp,
        top_k: topk,
      };
    } else {
      payload = {
        lang: lang,
        prompt: prompt,
        n: num,
        apikey: apiKey,
        apisecret: apiSecret,
        temperature: temp,
        top_p: topp,
        top_k: topk,
      };
    }
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });
    let editor = vscode.window.activeTextEditor;
    let document = editor?.document;
    let lastLine = document?.lineAt(document.lineCount - 1);
    let endPosition = lastLine?.range.end;
    let inputText;
    if (endPosition) {
      let input =
        new vscode.Selection(0, 0, endPosition.line, endPosition.character) ||
        new vscode.Selection(0, 0, 0, 0);
      inputText = document?.getText(input) || '';
    } else {
      inputText = prompt;
    }
    let commandid: string;
    let time1 = new Date().getTime();

    // resolve(null)
    // return
    // try {
    //     commandid = await getStartData(inputText, prompt, lang, mode);
    // } catch (err) {
    //     console.log(err);
    //     commandid = "";
    // }
    try {
      if (abortController) {
        abortController.abort('Cancel');
      }

      let time2 = new Date().getTime();
      abortController = new AbortController();

      console.log('getCodeCompletions', '开始请求');
      const app = await Client.connect('http://192.168.14.17:9997/CodeQwen1.5-7B/');
      const res = await app.predict('/complete', [
        prompt,
        50, // number (numeric value between 1 and 8192) in 'Max Tokens' Slider component
        1, // number (numeric value between 0 and 2) in 'Temperature' Slider component
        '', // string  in 'LoRA Name' Textbox component
      ]);
      console.log(res);
      // const res = await openaiCompletions({
      //   // model: 'CodeQwen1.5-7B-Chat',

      //   baseURL: 'http://54.252.195.195',
      //   signal: abortController.signal,

      //   timeout: 1200,
      //   headers: {
      //     Authorization: '',
      //   },
      //   data: {
      //     model: 'gpt-3.5-turbo-instruct',
      //     prompt: prompt,
      //     n: num,
      //     temperature: temp || 0.8,
      //     top_p: topp || 1,
      //     stream: false,
      //   },
      // });

      // const res = await fetch('http://54.252.195.195/v1/completions', {
      //   signal: abortController.signal,
      //   method: 'post',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     Authorization: '',
      //   },
      //   body: JSON.stringify({
      //     model: 'gpt-3.5-turbo-instruct',
      //     prompt: prompt,
      //     temperature: temp || 0.8,
      //     n: num,
      //     top_p: topp || 1,
      //   }),
      // });
      abortController = null;

      let codeArray: string[] = [((res?.data?.[0] as string) || '').replace(prompt, '')]; // res.choices.map((item) => item.text);
      const completions = Array<string>();
      for (let i = 0; i < codeArray.length; i++) {
        const completion = codeArray[i];
        if (!completion) continue;

        let tmpstr = completion;
        if (tmpstr.trim() === '') continue;
        if (completions.includes(completion)) continue;
        completions.push(completion);
      }
      let timeEnd = new Date().getTime();
      console.log(timeEnd - time1, timeEnd - time2);
      resolve({ completions, commandid });
      // axios
      //     .post(API_URL, payload, { proxy: false, timeout: 120000 })
      //     .then(async (res) => {
      //         console.log(res);
      //         console.log(
      //             "process time: " + res.data.result.process_time
      //         );
      //         if (res?.data.status === 0) {
      //             let codeArray = res?.data.result.output.code;
      //             const completions = Array<string>();
      //             for (let i = 0; i < codeArray.length; i++) {
      //                 const completion = codeArray[i];
      //                 let tmpstr = completion;
      //                 if (tmpstr.trim() === "") continue;
      //                 if (completions.includes(completion)) continue;
      //                 completions.push(completion);
      //             }
      //             let timeEnd = new Date().getTime();
      //             console.log(timeEnd - time1, timeEnd - time2);
      //             resolve({ completions, commandid });
      //         } else {
      //             // try {
      //             //     await getEndData(commandid, res.data.message, "No");
      //             // } catch (err) {
      //             //     console.log(err);
      //             // }
      //             // reject(res.data.message);
      //         }
      //     })
      //     .catch((err) => {
      //         reject(err);
      //     });
    } catch (err) {
      abortController = null;
      if (err?.message === 'Cancel') {
        console.log('getCodeCompletions', '取消补全');
        return resolve({ completions: [], commandid });
      }
      reject(err);
    }
  });
}
