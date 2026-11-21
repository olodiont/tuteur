// Fausse API VS Code, juste assez pour tester le handler du participant sans lancer VS Code.

export class MarkdownString {
  constructor(public value = '') {}
}
export class ChatResponseMarkdownPart {
  value: MarkdownString;
  constructor(value: string) {
    this.value = new MarkdownString(value);
  }
}
export class ChatRequestTurn {
  constructor(
    public prompt: string,
    public command: string | undefined,
    public references: unknown[] = [],
  ) {}
}
export class ChatResponseTurn {
  constructor(
    public response: unknown[],
    public result: { metadata?: Record<string, unknown> },
    public command?: string,
  ) {}
}
export class Uri {
  constructor(public fsPath: string, public scheme = 'file') {}
  toString() {
    return `${this.scheme}://${this.fsPath}`;
  }
}
export class Location {
  constructor(public uri: Uri, public range: unknown) {}
}
export class TabInputText {
  constructor(public uri: Uri) {}
}
export class ThemeIcon {
  constructor(public id: string) {}
}
export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}
export enum FileType {
  File = 1,
  Directory = 2,
}

export const LanguageModelChatMessage = {
  User: (content: string) => ({ role: 'user', content }),
  Assistant: (content: string) => ({ role: 'assistant', content }),
};

export class LanguageModelError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
  static NoPermissions = Object.assign((m?: string) => new LanguageModelError(m ?? '', 'NoPermissions'), {});
  static Blocked = Object.assign((m?: string) => new LanguageModelError(m ?? '', 'Blocked'), {});
  static NotFound = Object.assign((m?: string) => new LanguageModelError(m ?? '', 'NotFound'), {});
}
// Le vrai `LanguageModelError.Blocked.name` vaut "Blocked" : on garde ce contrat.
Object.defineProperty(LanguageModelError.NoPermissions, 'name', { value: 'NoPermissions' });
Object.defineProperty(LanguageModelError.Blocked, 'name', { value: 'Blocked' });
Object.defineProperty(LanguageModelError.NotFound, 'name', { value: 'NotFound' });

export const etat = {
  diagnostics: [] as [Uri, { severity: DiagnosticSeverity; message: string; range: { start: { line: number } } }[]][],
  modelesCopilot: [] as unknown[],
};

export const window = {
  activeTextEditor: undefined as unknown,
  tabGroups: { all: [] as { tabs: { input: unknown }[] }[] },
};

export const languages = {
  getDiagnostics: (uri?: Uri) => {
    if (!uri) return etat.diagnostics;
    return etat.diagnostics.find(([u]) => u.toString() === uri.toString())?.[1] ?? [];
  },
};

export const workspace = {
  fs: { stat: async () => ({ type: FileType.File, size: 10 }) },
  openTextDocument: async () => {
    throw new Error('non simulé');
  },
};

export const lm = {
  selectChatModels: async () => etat.modelesCopilot,
};

export let participantCree: { handler: Function; followupProvider?: { provideFollowups: Function } } | undefined;

export const chat = {
  createChatParticipant: (_id: string, handler: Function) => {
    participantCree = { handler };
    return participantCree;
  },
};
