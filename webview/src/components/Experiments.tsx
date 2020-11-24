import * as React from 'react'
import {
  DataFileDict,
  DVCExperimentsRepoJSONOutput,
  DVCExperiment,
  DVCExperimentWithSha
} from 'dvc-integration/src/DvcReader'
import {
  Cell,
  TableInstance,
  Row,
  Column,
  ColumnInstance,
  useTable,
  useGroupBy,
  useExpanded,
  useSortBy,
  useFlexLayout,
  HeaderGroup
} from 'react-table'
import cx from 'classnames'
import dayjs from '../dayjs'

const { useCallback, useMemo, useEffect } = React

interface DVCExperimentRow extends DVCExperimentWithSha {
  subRows?: DVCExperimentRow[]
}

const parseExperimentJSONEntry: (
  sha: string,
  experiment: DVCExperiment
) => DVCExperimentWithSha = (sha, experiment) => ({
  ...experiment,
  sha
})

const ColumnOptionsRow: React.FC<{
  column: ColumnInstance<DVCExperimentRow>
}> = ({ column }) => {
  return (
    <div>
      <div>
        <span>{'-'.repeat(column.depth)}</span> <span>{column.Header}</span>
        {column.canSort && (
          <button {...column.getSortByToggleProps()}>
            Sort
            {column.isSorted && <> ({column.isSortedDesc ? 'DESC' : 'ASC'})</>}
          </button>
        )}
        {(!column.columns || column.columns.length === 0) && (
          <button
            onClick={() => {
              column.toggleHidden()
            }}
          >
            {column.isVisible ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {column.columns &&
        column.columns.map(childColumn => (
          <ColumnOptionsRow column={childColumn} key={childColumn.id} />
        ))}
    </div>
  )
}

const parseExperiments = (experimentsData: DVCExperimentsRepoJSONOutput) => {
  return Object.entries(experimentsData).reduce<DVCExperimentRow[]>(
    (acc, [commitId, { baseline, ...childExperiments }]) => {
      return [
        ...acc,
        {
          ...parseExperimentJSONEntry(commitId, baseline),
          subRows: Object.entries(childExperiments).map(([sha, experiment]) =>
            parseExperimentJSONEntry(sha, experiment)
          )
        }
      ]
    },
    []
  )
}

interface ObjectEntriesWithParents {
  skippedKeys: string[]
  entries: [string, any][]
}

export const getBranchingEntries: (
  input: Record<string, any>,
  skippedKeys?: string[]
) => ObjectEntriesWithParents = (input, skippedKeys = []) => {
  const entries = Object.entries(input)
  if (entries.length === 1) {
    const [key, value] = entries[0]
    const newPath = [...skippedKeys, key]
    if (typeof value === 'object') {
      return getBranchingEntries(value, newPath)
    }
  }
  return {
    skippedKeys,
    entries
  }
}

const arrayAccessor: <T = string>(
  pathArray: string[]
) => (originalRow: any) => T = pathArray => originalRow =>
  pathArray.reduce((acc, cur) => acc[cur], originalRow)

const buildColumnsFromSampleObject: (
  data: Record<string, any>,
  parents?: string[]
) => Column<DVCExperimentRow>[] = (data, oldParents = []) => {
  const entries = Object.entries(data)
  return entries.map(([fieldName, value]) => {
    const currentPath = [...oldParents, fieldName]
    const base: Column<any> & {
      columns?: Column<any>[]
    } = {
      Header: fieldName,
      id: currentPath.join('___'),
      accessor: arrayAccessor(currentPath)
    }
    if (typeof value === 'object') {
      return {
        ...base,
        disableSortBy: true,
        columns: buildColumnsFromSampleObject(value, currentPath)
      }
    }
    return base
  })
}

const buildNestedColumnsFromExperiments: (def: {
  data: DVCExperimentRow[]
  accessor: keyof DVCExperimentRow
}) => Column<DVCExperimentRow>[] = ({ accessor, data }) => {
  if (!data || data.length === 0) {
    return []
  }
  return buildColumnsFromSampleObject(data[0][accessor] as DataFileDict, [
    accessor
  ])
}

const TruncatedCell = ({ value }: { value: string }) =>
  value && value.length && value.length > 12
    ? `${value.slice(0, 4)}...${value.slice(value.length - 4)}`
    : value

const ParentHeaderGroup: React.FC<{
  headerGroup: HeaderGroup<DVCExperimentRow>
}> = ({ headerGroup }) => {
  return (
    <div
      {...headerGroup.getHeaderGroupProps({
        className: cx('parent-headers-row', 'tr')
      })}
    >
      {headerGroup.headers.map(column => (
        <span
          {...column.getHeaderProps({
            className: cx(
              'th',
              column.placeholderOf
                ? 'placeholder-header-cell'
                : 'parent-header-cell',
              {
                'grouped-header': column.isGrouped
              }
            )
          })}
          key={column.id}
        >
          <div>{column.render('Header')}</div>
        </span>
      ))}
    </div>
  )
}

const FirstCell: React.FC<{ cell: Cell<DVCExperimentRow, any> }> = ({
  cell
}) => {
  const { row } = cell
  const baseFirstCellProps = cell.getCellProps({
    className: cx('td', 'experiment-cell', {
      'group-placeholder': cell.isPlaceholder,
      'grouped-column-cell': cell.column.isGrouped,
      'grouped-cell': cell.isGrouped
    })
  })
  const firstCellProps = row.canExpand
    ? row.getToggleRowExpandedProps({
        ...baseFirstCellProps,
        className: cx(
          baseFirstCellProps.className,
          'expandable-experiment-cell',
          row.isExpanded
            ? 'expanded-experiment-cell'
            : 'contracted-experiment-cell'
        )
      })
    : baseFirstCellProps

  return (
    <div {...firstCellProps}>
      <span
        className={
          row.canExpand
            ? row.isExpanded
              ? 'expanded-row-arrow'
              : 'contracted-row-arrow'
            : 'row-arrow-placeholder'
        }
      />
      <span className={row.original.queued ? 'queued-bullet' : 'bullet'} />
      {cell.isGrouped ? (
        <>
          <span {...row.getToggleRowExpandedProps()}>
            {row.isExpanded ? '👇' : '👉'} {cell.render('Cell')} (
            {row.subRows.length})
          </span>
        </>
      ) : cell.isAggregated ? (
        cell.render('Aggregated')
      ) : cell.isPlaceholder ? null : (
        cell.render('Cell')
      )}
    </div>
  )
}

const PrimaryHeaderGroup: React.FC<{
  headerGroup: HeaderGroup<DVCExperimentRow>
}> = ({ headerGroup }) => (
  <div
    className="tr"
    {...headerGroup.getHeaderGroupProps({
      className: 'headers-row'
    })}
  >
    {headerGroup.headers.map(header => (
      <span
        {...header.getHeaderProps(
          header.getSortByToggleProps({
            className: cx('th', {
              'grouped-header': header.isGrouped,
              'sorted-header': header.isSorted
            })
          })
        )}
      >
        <div>
          {header.render('Header')}
          {header.isSorted && <span>{header.isSortedDesc ? '↓' : '↑'}</span>}
        </div>
      </span>
    ))}
  </div>
)

const TableRow: React.FC<{
  row: Row<DVCExperimentRow>
  instance: TableInstance<DVCExperimentRow>
}> = ({ row, instance, instance: { prepareRow } }) => {
  prepareRow(row)
  const [firstCell, ...cells] = row.cells
  const baseRow = (
    <div
      {...row.getRowProps({
        className: cx(
          'tr',
          row.original.sha === 'workspace' ? 'workspace-row' : 'normal-row'
        )
      })}
    >
      <FirstCell cell={firstCell} />
      {cells.map(cell => {
        return (
          <div
            {...cell.getCellProps({
              className: cx('td', {
                'group-placeholder': cell.isPlaceholder,
                'grouped-column-cell': cell.column.isGrouped,
                'grouped-cell': cell.isGrouped
              })
            })}
            key={`${cell.column.id}___${cell.row.id}`}
          >
            {cell.isGrouped ? (
              <>
                <span {...row.getToggleRowExpandedProps()}>
                  {row.isExpanded ? '👇' : '👉'} {cell.render('Cell')} (
                  {row.subRows.length})
                </span>
              </>
            ) : cell.isAggregated ? (
              cell.render('Aggregated')
            ) : cell.isPlaceholder ? null : (
              cell.render('Cell')
            )}
          </div>
        )
      })}
    </div>
  )
  return row.subRows && row.subRows.length > 0 ? (
    <div
      className={cx('tr', 'row-group', {
        'workspace-row-group': row.values.sha === 'workspace'
      })}
    >
      {baseRow}
      {row.isExpanded &&
        row.subRows.map(subRow => (
          <TableRow instance={instance} row={subRow} />
        ))}
    </div>
  ) : (
    baseRow
  )
}

const TableBody: React.FC<{
  instance: TableInstance<DVCExperimentRow>
}> = ({ instance, instance: { rows, getTableBodyProps } }) => {
  return (
    <div className="tbody" {...getTableBodyProps()}>
      {rows.map(row => {
        return <TableRow row={row} instance={instance} key={row.id} />
      })}
    </div>
  )
}

function ungroupByCommit(instance: TableInstance<DVCExperimentRow>) {
  const {
    rows,
    dispatch,
    state: { ungrouped }
  } = instance
  const toggleCommitUngroup = useCallback(
    setting =>
      dispatch({
        type: 'set-ungrouped',
        setting
      }),
    [dispatch]
  )
  Object.assign(instance, {
    preSortedRows: rows,
    toggleCommitUngroup
  })
  const ungroupedRows = useMemo(
    () =>
      rows.reduce<Row<DVCExperimentRow>[]>((acc, row) => {
        if (row.subRows) {
          const result = [
            ...acc,
            { ...row, subRows: [] },
            ...row.subRows
          ].map((item, index) => ({ ...item, index }))
          return result
        }
        return [...acc, row]
      }, []),
    [rows]
  )
  if (!ungrouped) return
  Object.assign(instance, {
    rows: ungroupedRows
  })
}

export const ExperimentsTable: React.FC<{
  experiments: DVCExperimentsRepoJSONOutput
}> = ({ experiments }) => {
  const [initialState, defaultColumn] = useMemo(() => {
    const initialState = {}
    const defaultColumn: Partial<Column<DVCExperimentRow>> = {
      Cell: ({ value }: { value?: string | number }) => {
        return !value
          ? null
          : typeof value === 'number'
          ? value.toLocaleString(undefined, {
              maximumFractionDigits: 2
            })
          : value
      }
    }
    return [initialState, defaultColumn]
  }, [])

  const [data, columns] = useMemo(() => {
    const data = parseExperiments(experiments)
    const columns = [
      {
        Header: 'Experiment',
        accessor: (item: any) => item.name || item.sha,
        Cell: TruncatedCell,
        disableGroupBy: true,
        width: 175
      },
      {
        Header: 'Timestamp',
        accessor: 'timestamp',
        Cell: ({ value }: { value: string }) => {
          if (!value || value === '') return null
          const time = dayjs(value)
          return time.format(time.isToday() ? 'HH:mm:ss' : 'YYYY/MM/DD')
        }
      },
      ...buildNestedColumnsFromExperiments({
        accessor: 'params',
        data
      }),
      ...buildNestedColumnsFromExperiments({
        accessor: 'metrics',
        data
      })
    ] as Column<DVCExperimentRow>[]
    return [data, columns]
  }, [experiments])

  const instance = useTable<DVCExperimentRow>(
    {
      columns,
      data,
      initialState,
      isMultiSortEvent: () => true,
      defaultColumn,
      expandSubRows: false
    },
    hooks => {
      hooks.stateReducers.push((state, action) => {
        if (action.type === 'set-ungrouped') {
          return {
            ...state,
            ungrouped: action.setting || !state.ungrouped
          }
        }
        return state
      })
      hooks.useInstance.push(ungroupByCommit)
    },
    useGroupBy,
    useSortBy,
    useExpanded,
    useFlexLayout,
    hooks => {
      hooks.useInstance.push(instance => {
        const { allColumns } = instance
        const sortedColumns: ColumnInstance<DVCExperimentRow>[] = useMemo(
          () => allColumns.filter(column => column.isSorted),
          [allColumns]
        )
        Object.assign(instance, {
          sortedColumns
        })
      })
    }
  )

  const {
    getTableProps,
    toggleAllRowsExpanded,
    columns: columnInstances,
    toggleCommitUngroup,
    headerGroups,
    state,
    sortedColumns
  } = instance

  useEffect(() => {
    toggleAllRowsExpanded()
  }, [])

  const lastHeaderGroupIndex = headerGroups.length - 1
  const lastHeaderGroup = headerGroups[lastHeaderGroupIndex]

  return (
    <div>
      <details className="options-panel">
        <summary>
          <b>Options</b>
          <div>Sorted by:</div>
          <div>
            {sortedColumns.map(column => (
              <span key={column.id}>
                {column.render('Header')} (
                {column.isSortedDesc ? 'DESC' : 'ASC'})
              </span>
            ))}
          </div>
        </summary>
        {columnInstances.map(column => (
          <ColumnOptionsRow column={column} />
        ))}
        <button onClick={() => toggleCommitUngroup()}>
          {state.ungrouped ? 'Group' : 'Ungroup'} by Commit
        </button>
      </details>
      <div className="table" {...getTableProps()}>
        <div className="thead">
          {headerGroups.slice(0, lastHeaderGroupIndex).map(headerGroup => (
            <ParentHeaderGroup headerGroup={headerGroup} key={headerGroup.id} />
          ))}
          <PrimaryHeaderGroup headerGroup={lastHeaderGroup} />
        </div>
        <TableBody instance={instance} />
      </div>
    </div>
  )
}

const Experiments: React.FC<{
  experiments?: DVCExperimentsRepoJSONOutput | null
}> = ({ experiments }) => (
  <div className="experiments">
    <h1>Experiments</h1>
    {experiments ? (
      <ExperimentsTable experiments={experiments} />
    ) : (
      <p>Loading experiments...</p>
    )}
  </div>
)

export default Experiments
