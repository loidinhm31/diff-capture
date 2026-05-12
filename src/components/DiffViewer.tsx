import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'

interface Props {
  oldText: string
  newText: string
  oldTitle?: string
  newTitle?: string
}

export function DiffViewer({ oldText, newText, oldTitle = 'PDF A', newTitle = 'PDF B' }: Props) {
  return (
    <div className="diff-viewer">
      <ReactDiffViewer
        oldValue={oldText}
        newValue={newText}
        splitView
        compareMethod={DiffMethod.WORDS}
        leftTitle={oldTitle}
        rightTitle={newTitle}
        useDarkTheme={false}
        styles={{
          variables: {
            light: {
              diffViewerBackground: '#fafafa',
              addedBackground: '#e6ffec',
              addedColor: '#24292f',
              removedBackground: '#ffebe9',
              removedColor: '#24292f',
              wordAddedBackground: '#abf2bc',
              wordRemovedBackground: '#ffc1ba',
            },
          },
        }}
      />
    </div>
  )
}
