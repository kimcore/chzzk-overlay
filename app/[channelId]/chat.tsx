"use client"

import useWebSocket, {ReadyState} from "react-use-websocket"
import {Fragment, useEffect, useState} from "react"
import {useSearchParams} from "next/navigation"

const colors = [
    "rgb(219, 74, 63)",
    "rgb(95, 158, 160)",
    "rgb(218, 165, 32)",
    "rgb(0, 255, 127)",
    "rgb(180, 84, 255)",
    "rgb(30, 144, 255)"
]

const emojiRegex = /{:([a-zA-Z0-9_]+):}/g

export default function Chat({chatChannelId, accessToken}) {
    const {sendMessage, lastJsonMessage, readyState} = useWebSocket("wss://kr-ss1.chat.naver.com/chat")
    const [chats, setChats] = useState([])

    const searchParams = useSearchParams()
    const small = searchParams.has("small")

    const defaults = {
        cid: chatChannelId,
        svcid: "game",
        ver: "2"
    }

    useEffect(() => {
        if (lastJsonMessage) {
            const json = lastJsonMessage as any

            switch (json.cmd) {
                case 0:
                    sendMessage(JSON.stringify({
                        cmd: 100,
                        ver: "2"
                    }))
                    break
                case 10100:
                    const sid = json['bdy']['sid']
                    sendMessage(JSON.stringify({
                        bdy: {recentMessageCount: 50},
                        cmd: 5101,
                        sid,
                        tid: 2,
                        ...defaults
                    }))
                    break
                case 93101:
                case 15101:
                    const list = (json.cmd == 93101 ? json['bdy'] : json['bdy']['messageList'])
                        .filter(chat => (chat['msgTypeCode'] || chat['messageTypeCode']) == 1)
                        .map(chat => {
                            const profile = JSON.parse(chat['profile'])
                            const nickname = profile.nickname
                            const color = nickname.split("")
                                .map(c => c.charCodeAt(0))
                                .reduce((a, b) => a + b, 0) % colors.length
                            const badges = profile['activityBadges']?.map(badge => badge['imageUrl']) || []
                            const extras = JSON.parse(chat['extras'])
                            const emojis = extras.emojis || {}
                            const message = chat['msg'] || chat['content']
                            
                            return {
                                badges,
                                color,
                                nickname,
                                emojis,
                                message
                            }
                        })

                    setChats((prevState) => {
                        const newChats = prevState.concat(list)

                        if (newChats.length > 50) {
                            newChats.splice(0, newChats.length - 50)
                        }

                        return newChats
                    })

                    break
            }
        }

        window.scrollTo(0, document.body.scrollHeight)
    }, [lastJsonMessage])

    useEffect(() => {
        if (readyState == ReadyState.OPEN) {
            sendMessage(JSON.stringify({
                bdy: {
                    accTkn: accessToken,
                    auth: "READ",
                    devType: 2001,
                    uid: null
                },
                cmd: 100,
                tid: 1,
                ...defaults
            }))
        }
    }, [readyState])

    return (
        <div className="rounded-lg overflow-hidden">
            <div className={`flex flex-col gap-1 p-2 ${small ? "text-xl" : "pb-4"}`}>
                {chats.map(chat => {
                    const match = chat.message.match(emojiRegex)

                    return (
                        <div className="text-stroke">
                            {chat.badges.map(badge => (
                                <img alt="" className="inline-block w-6 h-6 mr-1" src={badge}/>
                            ))}
                            <span style={{
                                color: colors[chat.color]
                            }} className="mr-1">
                                {chat.nickname}:
                            </span>
                            <span className="text-white">
                                {match ? (
                                    <Fragment>
                                        {chat.message.split(emojiRegex).map((part, i) => {
                                            if (i % 2 == 0) {
                                                return part
                                            } else {
                                                const src = chat.emojis[part]
                                                return <img alt="" className="inline-block w-7 h-7 mr-1" src={src}/>
                                            }
                                        })}
                                    </Fragment>
                                ) : (
                                    chat.message
                                )}
                            </span>
                        </div>
                    )
                })}
            </div>
            {!small && <div className="top-shadow"/>}
        </div>
    )
}