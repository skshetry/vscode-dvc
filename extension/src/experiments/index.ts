import { EventEmitter } from 'vscode'
import { experimentShow } from '../cli/reader'
import { Config } from '../Config'
import { ExperimentsRepoJSONOutput } from '../webviews/experiments/contract'

export class Experiments {
  private config: Config

  private _currentUpdatePromise?: Thenable<ExperimentsRepoJSONOutput>

  private _data?: ExperimentsRepoJSONOutput
  public get data() {
    return this._data
  }

  private dataUpdateStarted: EventEmitter<
    Thenable<ExperimentsRepoJSONOutput>
  > = new EventEmitter()

  public readonly onDidStartDataUpdate = this.dataUpdateStarted.event

  private dataUpdated: EventEmitter<
    ExperimentsRepoJSONOutput
  > = new EventEmitter()

  public readonly onDidUpdateData = this.dataUpdated.event

  private dataUpdateFailed: EventEmitter<Error> = new EventEmitter()
  public readonly onDidFailDataUpdate = this.dataUpdateFailed.event

  public async update(): Promise<ExperimentsRepoJSONOutput> {
    if (!this._currentUpdatePromise) {
      try {
        const updatePromise = experimentShow({
          pythonBinPath: this.config.pythonBinPath,
          cliPath: this.config.dvcPath,
          cwd: this.config.workspaceRoot
        })
        this._currentUpdatePromise = updatePromise
        this.dataUpdateStarted.fire(updatePromise)
        const experimentData = await updatePromise
        this.dataUpdated.fire(experimentData)
        return experimentData
      } catch (e) {
        this.dataUpdateFailed.fire(e)
      } finally {
        this._currentUpdatePromise = undefined
      }
    }
    return this._currentUpdatePromise as Promise<ExperimentsRepoJSONOutput>
  }

  constructor(config: Config) {
    if (!config) {
      throw new Error('The Experiments class requires a Config instance!')
    }
    this.config = config
  }

  public dispose() {
    this.dataUpdateStarted.dispose()
    this.dataUpdated.dispose()
    this.dataUpdateFailed.dispose()
  }
}
