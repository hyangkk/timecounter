import { useState, useRef, useEffect } from 'react'
import './App.css'

function formatTime(sec: number) {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0')
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

interface RecordItem {
  id: number
  start: number
  end: number
  duration: number
}

function App() {
  const [isRunning, setIsRunning] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [records, setRecords] = useState<RecordItem[]>([])
  const timerRef = useRef<number | null>(null)

  // 오늘 날짜(yyyy-mm-dd)
  const todayStr = new Date().toISOString().slice(0, 10)

  // 오늘 기록만 필터
  const todayRecords = records.filter(r => {
    const d = new Date(r.start)
    return d.toISOString().slice(0, 10) === todayStr
  })

  // 오늘 누적 시간(초)
  const todayTotal = todayRecords.reduce((acc, cur) => acc + cur.duration, 0)

  // localStorage에서 기록 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem('records')
      alert('localStorage records 값: ' + saved)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecords(parsed)
          console.log('localStorage에서 불러온 기록:', parsed)
        }
      }
    } catch (e) {
      setRecords([])
      console.error('localStorage 파싱 에러', e)
    }
  }, [])

  // 기록이 바뀔 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('records', JSON.stringify(records))
    console.log('localStorage에 저장된 기록:', records)
  }, [records])

  // 스톱워치 시작
  const handleStart = () => {
    setIsRunning(true)
    const now = Date.now()
    setStartTime(now)
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - now) / 1000))
    }, 1000)
  }

  // 스톱워치 종료
  const handleStop = () => {
    setIsRunning(false)
    if (timerRef.current) clearInterval(timerRef.current)
    if (startTime) {
      const end = Date.now()
      const duration = Math.floor((end - startTime) / 1000)
      setRecords([
        { id: Date.now(), start: startTime, end, duration },
        ...records,
      ])
      setElapsed(0)
      setStartTime(null)
    }
  }

  // 기록 삭제
  const handleDelete = (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    setRecords(records.filter(r => r.id !== id))
  }

  // 기록 수정
  const handleEdit = (id: number) => {
    const newSec = prompt('수정할 시간을 초 단위로 입력하세요:')
    if (!newSec) return
    const sec = parseInt(newSec)
    if (isNaN(sec) || sec < 0) return alert('올바른 숫자를 입력하세요.')
    setRecords(records.map(r => r.id === id ? { ...r, duration: sec } : r))
  }

  return (
    <div className="container">
      <h2 style={{ textAlign: 'center', margin: '24px 0 8px 0' }}>오늘 누적 시간</h2>
      <div style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, marginBottom: 16 }}>{formatTime(todayTotal)}</div>
      <div className="stopwatch-circle">
        <div className="stopwatch-time">{formatTime(isRunning ? elapsed : 0)}</div>
        <button className="stopwatch-btn" onClick={isRunning ? handleStop : handleStart}>
          {isRunning ? '종료' : '시작'}
        </button>
      </div>
      <div style={{ margin: '32px 0 16px 0', fontWeight: 600 }}>오늘의 기록</div>
      {todayRecords.length === 0 ? (
        <div style={{color:'#aaa', textAlign:'center'}}>오늘 기록 없음</div>
      ) : (
        <ul>
          {todayRecords.map((rec) => (
            <li key={rec.id}>
              {formatTime(rec.duration)} (시작: {new Date(rec.start).toLocaleTimeString()} ~ 종료: {new Date(rec.end).toLocaleTimeString()})
              <button onClick={() => handleEdit(rec.id)} style={{marginLeft:8}}>수정</button>
              <button onClick={() => handleDelete(rec.id)} style={{marginLeft:4}}>삭제</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
