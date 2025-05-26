import { Sheet } from './Sheet.js';

export interface Workbook {
    name: string;
    '@entity': string;
    sheets: Sheet[];
}