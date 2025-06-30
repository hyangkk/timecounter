import { useState, useEffect } from 'react'
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
  const userId = getUserIdFromUrlOrLocal();

  // 수동 기록 입력 상태
  const [manualSec, setManualSec] = useState('')
  const [manualDate, setManualDate] = useState(() => {
    const today = new Date()
    return today.toISOString().slice(0, 10)
  })
  const [adding, setAdding] = useState(false)

  // 날짜별로 기록 그룹핑
  const recordsByDate: { [date: string]: RecordItem[] } = {}
  const [records, setRecords] = useState<RecordItem[]>([])
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

  // KST 기준 날짜를 ms로 변환
  function getKstMs(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d, 0, 0, 0).getTime()
  }

  // 수동 기록 추가
  const handleAddManual = async () => {
    const sec = parseInt(manualSec)
    if (isNaN(sec) || sec <= 0) {
      alert('양의 정수를 입력하세요.')
      return
    }
    setAdding(true)
    // KST 기준 날짜의 00:00:00
    const ms = getKstMs(manualDate)
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
      <div style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, marginBottom: 16 }}>{formatTime(recordsByDate[new Date().toISOString().slice(0, 10)]?.reduce((acc, cur) => acc + cur.duration, 0) || 0)}</div>
      <div style={{ margin: '32px 0 16px 0', fontWeight: 600 }}>과거 날짜별 누적 시간</div>
      <table style={{ width: '100%', maxWidth: 400, margin: '0 auto 24px auto', borderCollapse: 'collapse', background: '#fafbfc' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ padding: 8, border: '1px solid #ddd' }}>날짜</th>
            <th style={{ padding: 8, border: '1px solid #ddd' }}>누적 시간</th>
          </tr>
        </thead>
        <tbody>
          {sortedDates.filter(dateStr => dateStr !== new Date().toISOString().slice(0, 10)).map(dateStr => {
            const total = recordsByDate[dateStr].reduce((acc, cur) => acc + cur.duration, 0)
            return (
              <tr key={dateStr}>
                <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>{dateStr}</td>
                <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>{formatTime(total)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
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
