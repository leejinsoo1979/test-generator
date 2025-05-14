import React, { useState } from 'react'
import PanelList from './PanelList'
import ExportPanel from './ExportPanel'

const RightPanel = ({ moduleState, updateModuleState, updatePanelColor, activePanelId, panelColors, setPanelColors }) => {
  const [activeTab, setActiveTab] = useState('panels') // 'panels' 또는 'json'
  const [copyFeedback, setCopyFeedback] = useState(false) // 복사 성공 피드백 상태
  
  // JSON 복사 함수
  const copyJsonToClipboard = () => {
    const jsonString = JSON.stringify(moduleState, null, 2)
    navigator.clipboard.writeText(jsonString)
      .then(() => {
        // 복사 성공 피드백 표시
        setCopyFeedback(true)
        // 2초 후 피드백 메시지 숨김
        setTimeout(() => {
          setCopyFeedback(false)
        }, 2000)
      })
      .catch(err => {
        console.error('클립보드 복사 실패:', err)
        alert('클립보드 복사 중 오류가 발생했습니다.')
      })
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* 헤더 - 고정 */}
      <div className="flex border-b mb-4 sticky top-0 bg-white z-10">
        <button
          className={`py-2 px-4 font-medium text-lg ${
            activeTab === 'panels' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'
          }`}
          onClick={() => setActiveTab('panels')}
        >
          패널리스트
        </button>
        <button
          className={`py-2 px-4 font-medium text-lg ${
            activeTab === 'json' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'
          }`}
          onClick={() => setActiveTab('json')}
        >
          JSON 코드
        </button>
      </div>

      {/* 패널리스트 - 스크롤 가능 영역 */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'panels' ? (
          <PanelList 
            moduleState={moduleState}
            updateModuleState={updateModuleState}
            updatePanelColor={updatePanelColor} 
            activePanelId={activePanelId}
            panelColors={panelColors}
            setPanelColors={setPanelColors}
          />
        ) : (
          <div className="bg-gray-100 rounded p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">모듈 JSON 데이터</h3>
              <div className="relative">
                <button 
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-3 rounded flex items-center transition-colors"
                  onClick={copyJsonToClipboard}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  복사하기
                </button>
                {copyFeedback && (
                  <div className="absolute right-0 top-full mt-2 bg-green-500 text-white text-xs py-1 px-2 rounded shadow-lg">
                    복사 완료!
                  </div>
                )}
              </div>
            </div>
            <pre className="bg-gray-800 text-green-400 p-4 rounded overflow-auto text-xs max-h-[500px]">
              {JSON.stringify(moduleState, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* 내보내기 패널은 항상 하단에 표시 - 고정 */}
      <div className="mt-6 sticky bottom-0 bg-white pt-2 border-t">
        <ExportPanel moduleState={moduleState} />
      </div>
    </div>
  )
}

export default RightPanel 