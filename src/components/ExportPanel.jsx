import React from 'react'

const ExportPanel = ({ moduleState }) => {
  // JSON 내보내기
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(moduleState, null, 2))
    const downloadAnchorNode = document.createElement('a')
    downloadAnchorNode.setAttribute('href', dataStr)
    downloadAnchorNode.setAttribute('download', `${moduleState.name || 'module'}.json`)
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 border-b pb-2">내보내기</h2>
      <div className="flex gap-4">
        <button className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 transition" onClick={handleExportJSON}>
          JSON 내보내기
        </button>
        <button className="bg-gray-300 text-gray-500 rounded px-4 py-2 cursor-not-allowed" disabled>
          glb 내보내기 (준비중)
        </button>
      </div>
    </div>
  )
}

export default ExportPanel
