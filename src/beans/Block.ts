import { JSONArray } from '@org-quicko/core';

export interface Block {
    name: string;
    '@entity': string;
    header?: string[];
    rows?: JSONArray;
    items?: JSONArray;
}