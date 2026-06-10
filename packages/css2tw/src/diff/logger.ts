import fs from 'fs';
import yaml from 'yaml';

export interface Logger {
  log(message: any): void;
  warn(message: any): void;
  error(message: any): void;
  fork(scopeName: string): Logger;
  close(): void;
}

export class YamlFileLogger implements Logger {
  private stream: fs.WriteStream;
  private indentLevel: number;

  constructor(filePathOrStream: string | fs.WriteStream, indentLevel: number = 0) {
    if (typeof filePathOrStream === 'string') {
      this.stream = fs.createWriteStream(filePathOrStream, { flags: 'w' });
    } else {
      this.stream = filePathOrStream;
    }
    this.indentLevel = indentLevel;
  }

  private writeItem(item: any) {
    const prefix = '  '.repeat(this.indentLevel);
    const yamlStr = yaml.stringify([item]);
    const indented = yamlStr.trim().split('\n').map(line => prefix + line).join('\n');
    this.stream.write(indented + '\n');
  }

  log(message: any): void {
    this.writeItem(message);
  }

  warn(message: any): void {
    this.writeItem(typeof message === 'string' ? `[WARN] ${message}` : { warn: message });
  }

  error(message: any): void {
    this.writeItem(typeof message === 'string' ? `[ERROR] ${message}` : { error: message });
  }

  fork(scopeName: string): Logger {
    let keyStr = yaml.stringify([{ [scopeName]: null }]).trim();
    if (keyStr.endsWith(': null')) {
      keyStr = keyStr.slice(0, -6) + ':';
    }
    this.stream.write('  '.repeat(this.indentLevel) + keyStr + '\n');
    return new YamlFileLogger(this.stream, this.indentLevel + 1);
  }

  close(): void {
    if (this.indentLevel === 0) {
      this.stream.end();
    }
  }
}
