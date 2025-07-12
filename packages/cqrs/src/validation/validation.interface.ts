export interface ICqrsValidatable {
  validate?(): Promise<void> | void;
}
