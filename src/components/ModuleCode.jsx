import React from 'react'

const ModuleCode = ({ moduleState }) => {
  // 코드 복사 기능
  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(moduleState, null, 2))
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold border-b pb-2">모듈 코드 (JSON)</h2>
        <button className="bg-gray-200 text-gray-700 rounded px-3 py-1 text-xs hover:bg-gray-300 transition" onClick={handleCopy}>
          복사
        </button>
      </div>
      <pre className="bg-gray-900 text-green-200 rounded p-4 text-xs font-mono overflow-auto flex-1 min-h-[700px]">
        {JSON.stringify(moduleState, null, 2)}
      </pre>
    </div>
  )
}

export default ModuleCode
