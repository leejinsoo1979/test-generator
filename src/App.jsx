import React, { useState } from 'react'
import ModuleForm from './components/ModuleForm'
import ThreeViewer from './components/ThreeViewer'
import RightPanel from './components/RightPanel'
import useModuleState from './hooks/useModuleState'
import './App.css'

function App() {
  const [moduleState, updateModuleState, resetModule, addModule, updateModule] = useModuleState()
  const [selectedPanelColor, setSelectedPanelColor] = useState(null)
  const [activePanelId, setActivePanelId] = useState(null)
  const [panelColors, setPanelColors] = useState({})
  
  // 패널 색상 업데이트 함수
  const updatePanelColor = (panelId, color) => {
    // 기존 선택했던 패널과 같은 패널을 다시 클릭한 경우 취소 (토글)
    if (activePanelId === panelId) {
      setActivePanelId(null)
      setSelectedPanelColor(null)
      return
    }
    
    // 새로운 패널 활성화
    setActivePanelId(panelId)
    setSelectedPanelColor({ id: panelId, color: color })
    
    // 패널 색상 상태는 유지하면서 활성 패널만 변경
    // 이렇게 하면 모든 패널 색상을 다시 계산하지 않아도 됨
    const updatedPanelColors = { ...panelColors }
    setPanelColors(updatedPanelColors)
  }

  return (
    <div className="App w-full h-screen">
      <div className="flex h-full">
        <div className="w-1/4 overflow-y-auto p-4 border-r">
          <ModuleForm 
            moduleState={moduleState} 
            updateModuleState={updateModuleState} 
            resetModule={resetModule} 
            addModule={addModule}
            updateModule={updateModule}
          />
        </div>
        <div className="w-2/4 border-r">
          <ThreeViewer 
            moduleState={moduleState} 
            setModuleState={updateModuleState}
            selectedPanelColor={selectedPanelColor}
            activePanelId={activePanelId}
            panelColors={panelColors}
          />
        </div>
        <div className="w-1/4 p-4 flex flex-col h-full">
          <RightPanel 
            moduleState={moduleState}
            updateModuleState={updateModuleState}
            updatePanelColor={updatePanelColor}
            activePanelId={activePanelId}
            panelColors={panelColors}
            setPanelColors={setPanelColors}
          />
        </div>
      </div>
    </div>
  )
}

export default App