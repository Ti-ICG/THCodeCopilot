import { TargetLanguageCode, Translator } from 'deepl-node';
import dotenv from 'dotenv';
dotenv.config();

export type TargetLanguage = 'English' | 'Chinese' | 'Dutch' | 'French' | 'Japanese' | 'Spanish' | 'Russian' | 'Korean' | 'Turkish';

const authKey = process.env.DEEPL_AUTH_KEY ;
const translator = new Translator(authKey);

const getTargetCode = (targetLanguage: TargetLanguage): string => {
  switch (targetLanguage.toLowerCase()) {
    case 'english':
      return 'en';
    case 'chinese':
      return 'zh';
    case 'dutch':
      return 'NL';
    case 'french':
      return 'FR';
    case 'japanese':
      return 'JA';
    case 'spanish':
      return 'ES';
    case 'russian':
      return 'RU';
    case 'korean':
      return 'KO';
    case 'turkish':
      return 'TR';
    default:
      return 'EN';
  }
}
const getTranslateTextPromise = (text: string, targetCode: string) => {
  if(text === '') {
    return { text }
  }
  return translator.translateText(text, null, targetCode as TargetLanguageCode);
}

export const getMultipleTranslations = async (texts: string[], targetLanguage: TargetLanguage) => {
  console.log(targetLanguage);
  const targetCode = getTargetCode(targetLanguage);
  if (targetCode === 'en') {
    return texts;
  }

  const translationPromises = texts.map((text) => {
    return getTranslateTextPromise(text, targetCode);
  });
  const translatedText = await Promise.all(translationPromises);
  const translations = translatedText.map((translated) => {
    let translation = translated.text;
    if (targetCode === 'KO') {
      translation = translation.replace(/\s?(합|입)니다\.?$/, '');
    }
    return translation;
  });

  return translations;
}
