import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabaseClient'
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

function getUserIdFromUrlOrLocal() {
  const params = new URLSearchParams(window.location.search);
  const urlUser = params.get('user');
  if (urlUser) {
    localStorage.setItem('user_id', urlUser);
    return urlUser;
  }
  let id = localStorage.getItem('user_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('user_id', id);
  }
  return id;
}

function App() {
  const [isRunning, setIsRunning] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [records, setRecords] = useState<RecordItem[]>([])
  const timerRef = useRef<number | null>(null)
  const userId = getUserIdFromUrlOrLocal();

  // 오늘 날짜(yyyy-mm-dd)
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayRecords = records.filter(r => {
    const d = new Date(r.start)
    return d.toISOString().slice(0, 10) === todayStr
  })
  const todayTotal = todayRecords.reduce((acc, cur) => acc + cur.duration, 0)

  // 수동 기록 입력 상태
  const [manualSec, setManualSec] = useState('')
  const [manualDate, setManualDate] = useState(() => {
    const today = new Date()
    return today.toISOString().slice(0, 10)
  })
  const [adding, setAdding] = useState(false)

  // 날짜별로 기록 그룹핑
  const recordsByDate: { [date: string]: RecordItem[] } = {}
  records.forEach(r => {
    const d = new Date(r.start)
    const dateStr = d.toISOString().slice(0, 10)
    if (!recordsByDate[dateStr]) recordsByDate[dateStr] = []
    recordsByDate[dateStr].push(r)
  })
  const sortedDates = Object.keys(recordsByDate).sort((a, b) => b.localeCompare(a))

  // Supabase에서 기록 불러오기
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('records')
        .select('*')
        .eq('user_id', userId)
        .order('start', { ascending: false })
      if (data) setRecords(data)
    })()
  }, [userId])

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
  const handleStop = async () => {
    setIsRunning(false)
    if (timerRef.current) clearInterval(timerRef.current)
    if (startTime) {
      const end = Date.now()
      const duration = Math.floor((end - startTime) / 1000)
      // Supabase에 기록 추가
      const { data } = await supabase.from('records').insert([
        { user_id: userId, start: startTime, end, duration }
      ]).select()
      if (data) setRecords([data[0], ...records])
      setElapsed(0)
      setStartTime(null)
    }
  }

  // 기록 삭제
  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    await supabase.from('records').delete().eq('id', id)
    setRecords(records.filter(r => r.id !== id))
  }

  // 기록 수정
  const handleEdit = async (id: number) => {
    const newSec = prompt('수정할 시간을 초 단위로 입력하세요:')
    if (!newSec) return
    const sec = parseInt(newSec)
    if (isNaN(sec) || sec < 0) return alert('올바른 숫자를 입력하세요.')
    await supabase.from('records').update({ duration: sec }).eq('id', id)
    setRecords(records.map(r => r.id === id ? { ...r, duration: sec } : r))
  }

  // 내 기록 공유 링크
  const shareUrl = `${window.location.origin}${window.location.pathname}?user=${userId}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    alert('공유 링크가 복사되었습니다!')
  }

  // 수동 기록 추가
  const handleAddManual = async () => {
    const sec = parseInt(manualSec)
    if (isNaN(sec) || sec <= 0) {
      alert('양의 정수를 입력하세요.')
      return
    }
    setAdding(true)
    // 선택한 날짜의 00:00:00 기준 timestamp
    const date = new Date(manualDate + 'T00:00:00')
    const ms = date.getTime()
    const { data } = await supabase.from('records').insert([
      { user_id: userId, start: ms, end: ms, duration: sec }
    ]).select()
    if (data) setRecords([data[0], ...records])
    setManualSec('')
    setAdding(false)
  }

  return (
    <div className="container">
      <div style={{ margin: '0 0 24px 0', textAlign: 'center' }}>
        <button 
          onClick={handleCopy}
          style={{
            fontSize: 18,
            fontWeight: 700,
            padding: '14px 32px',
            background: '#646cff',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            boxShadow: '0 2px 8px #0002',
            cursor: 'pointer',
            marginBottom: 12
          }}
        >
          📋 내 기록 공유 링크 복사
        </button>
      </div>
      <h2 style={{ textAlign: 'center', margin: '24px 0 8px 0' }}>오늘 누적 시간</h2>
      <div style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, marginBottom: 16 }}>{formatTime(todayTotal)}</div>
      <div className="stopwatch-circle">
        <div className="stopwatch-time">{formatTime(isRunning ? elapsed : 0)}</div>
        <button
          className="stopwatch-btn"
          onClick={isRunning ? handleStop : handleStart}
          style={{
            fontSize: 28,
            fontWeight: 700,
            padding: '24px 0',
            width: 220,
            borderRadius: 32,
            marginTop: 18,
            marginBottom: 8
          }}
        >
          {isRunning ? '종료' : '시작'}
        </button>
      </div>
      <div style={{ margin: '32px 0 16px 0', fontWeight: 600 }}>날짜별 기록</div>
      {sortedDates.length === 0 ? (
        <div style={{color:'#aaa', textAlign:'center'}}>기록 없음</div>
      ) : (
        <div>
          {sortedDates.map(dateStr => {
            const list = recordsByDate[dateStr]
            const total = list.reduce((acc, cur) => acc + cur.duration, 0)
            return (
              <div key={dateStr} style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{dateStr} (누적 {formatTime(total)})</div>
                <ul>
                  {list.map((rec) => (
                    <li key={rec.id}>
                      {formatTime(rec.duration)}
                      {rec.start !== rec.end && (
                        <> (시작: {new Date(rec.start).toLocaleTimeString()} ~ 종료: {new Date(rec.end).toLocaleTimeString()})</>
                      )}
                      <button onClick={() => handleEdit(rec.id)} style={{marginLeft:8}}>수정</button>
                      <button onClick={() => handleDelete(rec.id)} style={{marginLeft:4}}>삭제</button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '32px 0 0 0' }}>
        <input
          type="number"
          min={1}
          placeholder="초 단위로 입력"
          value={manualSec}
          onChange={e => setManualSec(e.target.value)}
          style={{ fontSize: 18, padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', marginRight: 8, width: 140 }}
        />
        <input
          type="date"
          value={manualDate}
          onChange={e => setManualDate(e.target.value)}
          style={{ fontSize: 18, padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', marginRight: 8 }}
        />
        <button
          onClick={handleAddManual}
          disabled={adding}
          style={{ fontSize: 18, fontWeight: 600, padding: '10px 24px', borderRadius: 8, background: '#1a1a1a', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          기록 추가
        </button>
      </div>
    </div>
  )
}

export default App
