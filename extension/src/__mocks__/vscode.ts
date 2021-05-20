import { join } from 'path'
import { URI, Utils } from 'vscode-uri'

export const commands = jest.fn()
export const EventEmitter = jest.fn()
export const Extension = jest.fn()
export const extensions = jest.fn()
export const scm = jest.fn()
export const Terminal = jest.fn()
export const ThemeColor = jest.fn()
export const TreeItem = jest.fn()
export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2
}
export const Uri = {
  file: URI.file,
  joinPath: Utils.joinPath
}
export const window = {
  showInputBox: jest.fn(),
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showQuickPick: jest.fn()
}
export const workspace = {
  workspaceFolders: [
    {
      uri: {
        fsPath: join(__dirname, '..', '..')
      }
    }
  ]
}
export const WorkspaceEdit = jest.fn()
