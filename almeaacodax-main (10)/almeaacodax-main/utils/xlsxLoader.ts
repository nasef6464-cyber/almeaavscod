export type XlsxModule = typeof import('xlsx');

export const loadXlsx = async (): Promise<XlsxModule> => import('xlsx');
