import { Sheet } from './Sheet';

export interface Workbook {
    name: string;
    '@entity': string;
    sheets: Sheet[];
}