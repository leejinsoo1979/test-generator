import React, { useState } from 'react'
import ModuleForm from './components/ModuleForm'
import ThreeViewer from './components/ThreeViewer'
import ModuleCode from './components/ModuleCode'
import ExportPanel from './components/ExportPanel'
import useModuleState from './hooks/useModuleState'
import './App.css'

function App() {
  const [moduleState, updateModuleState, resetModule, addModule, updateModule] = useModuleState()

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
          />
        </div>
        <div className="w-1/4 p-4 overflow-y-auto">
          <ModuleCode moduleState={moduleState} />
          <div className="mt-6">
            <ExportPanel moduleState={moduleState} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App